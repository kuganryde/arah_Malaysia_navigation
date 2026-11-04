// ar-vision v0.3.1
// Web Worker host for the AR engine. Running inference here keeps the WebGL work and pixel read-backs off the
// main thread, so the map keeps rendering smoothly and its WebGL context is never shared with the model's.
/* global ort */
'use strict';
let engine = null;

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      // URLs come from this worker's own location, never from the message, so nothing a caller sends can redirect
      // the script, engine or model load to another origin.
      if (!/^[0-9a-f]{64}$/.test(m.sha256) || m.size !== 416) throw Object.assign(new Error('bad init'), { code: 'run' });
      importScripts(new URL('vendor/ort.webgl.min.js', self.location.href).href); // vendored onnxruntime-web, same origin
      const { Engine } = await import(new URL('ar-engine.mjs', self.location.href).href);
      engine = await Engine.create({ ort: self.ort, modelUrl: new URL('models/yolox_nano.onnx', self.location.href).href, sha256: m.sha256, size: m.size, allowSoftware: m.allowSoftware === true });
      self.postMessage({ type: 'ready' });
    } else if (m.type === 'frame') {
      try {
        const r = await engine.detect(m.bitmap, m.vw, m.vh, m.lane);
        self.postMessage({ type: 'result', id: m.id, ...r });
      } finally { m.bitmap.close(); } // always free the GPU-backed frame
    } else if (m.type === 'close') {
      if (engine) engine.dispose();
      self.close();
    }
  } catch (err) {
    // Only a code and message cross to the page; no frame data is ever included.
    self.postMessage({ type: 'error', id: m.id, code: (err && err.code) || 'run', message: String((err && err.message) || err) });
  }
};
