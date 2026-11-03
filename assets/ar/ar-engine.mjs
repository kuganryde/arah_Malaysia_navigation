// ar-vision v0.1.1
// The heavy half of AR driver assist: model verification, WebGL inference, post-processing, lane finding and
// traffic-light colour. It has no UI and runs identically in a Web Worker (preferred: keeps the map's main
// thread and WebGL context untouched) or on the main thread (fallback for browsers without OffscreenCanvas).
import * as core from './ar-core.mjs';

const hex = (buf) => Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');
const fail = (code, msg) => Object.assign(new Error(msg || code), { code });

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export class Engine {
  /** Fetch + verify + load the model. Throws Error with .code: nowebgl | load | modelhash | run. */
  static async create({ ort, modelUrl, sha256, size = core.SIZE }) {
    let gl = null;
    try { gl = makeCanvas(1, 1).getContext('webgl2') || makeCanvas(1, 1).getContext('webgl'); } catch (e) { /* no GL */ }
    if (!gl) throw fail('nowebgl');
    ort.env.logLevel = 'error';
    let buf;
    try {
      const res = await fetch(modelUrl, { credentials: 'omit' });
      if (!res.ok) throw new Error('model http ' + res.status);
      buf = await res.arrayBuffer();
    } catch (e) { throw fail('load', String(e && e.message)); }
    // Never run a model that is not the pinned one (supply-chain guard).
    if (hex(await crypto.subtle.digest('SHA-256', buf)) !== sha256) throw fail('modelhash');
    let session;
    try { session = await ort.InferenceSession.create(new Uint8Array(buf), { executionProviders: ['webgl'], graphOptimizationLevel: 'all' }); }
    catch (e) { throw fail('load', String(e && e.message)); }
    return new Engine(ort, session, size);
  }

  constructor(ort, session, size) {
    this.ort = ort; this.session = session; this.size = size;
    this.inName = session.inputNames[0]; this.outName = session.outputNames[0];
    this.pre = makeCanvas(size, size); this.preCtx = this.pre.getContext('2d', { willReadFrequently: true });
    this.input = new Float32Array(3 * size * size);
    this.lane = null; this.laneCtx = null; this.laneW = 192; this.laneH = 0;
    this.light = makeCanvas(24, 24); this.lightCtx = this.light.getContext('2d', { willReadFrequently: true });
  }

  /**
   * One frame. src: ImageBitmap or HTMLVideoElement of vw x vh.
   * Returns frame-pixel boxes (cls, score), optional lane fit, traffic-light colours and the inference time.
   */
  async detect(src, vw, vh, wantLane) {
    const { size } = this;
    const lb = core.letterbox(vw, vh, size);
    this.preCtx.fillStyle = 'rgb(114,114,114)'; // YOLOX letterbox padding value
    this.preCtx.fillRect(0, 0, size, size);
    this.preCtx.drawImage(src, 0, 0, lb.nw, lb.nh);
    core.toCHW_BGR(this.preCtx.getImageData(0, 0, size, size).data, size, this.input);
    const t0 = performance.now();
    const out = await this.session.run({ [this.inName]: new this.ort.Tensor('float32', this.input, [1, 3, size, size]) });
    const boxes = core.toFrame(core.nms(core.decodeYolox(out[this.outName].data)), vw, vh, size);
    const inferMs = performance.now() - t0;

    let lane = null;
    if (wantLane) {
      const lh = Math.round((this.laneW * vh) / vw);
      if (!this.lane || this.laneH !== lh) { this.lane = makeCanvas(this.laneW, lh); this.laneCtx = this.lane.getContext('2d', { willReadFrequently: true }); this.laneH = lh; }
      this.laneCtx.drawImage(src, 0, 0, this.laneW, lh);
      const px = this.laneCtx.getImageData(0, 0, this.laneW, lh).data;
      const g = new Uint8Array(this.laneW * lh);
      for (let i = 0, p = 0; i < g.length; i++, p += 4) g[i] = (px[p] * 77 + px[p + 1] * 150 + px[p + 2] * 29) >> 8; // BT.601 luma
      lane = core.detectLanes(g, this.laneW, lh);
    }
    for (const b of boxes) {
      if (!core.GROUP.trafficLight.has(b.cls)) continue;
      this.lightCtx.drawImage(src, b.x1, b.y1, Math.max(2, b.x2 - b.x1), Math.max(2, b.y2 - b.y1), 0, 0, 24, 24);
      b.color = core.classifyLight(this.lightCtx.getImageData(0, 0, 24, 24).data);
    }
    return { boxes, lane, laneW: this.laneW, laneH: this.laneH, inferMs };
  }

  dispose() { try { this.session.release(); } catch (e) { /* already released */ } }
}
