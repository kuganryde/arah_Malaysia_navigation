// ar-vision v0.1.0
// Web Worker host for the AR engine. Running inference here keeps the WebGL work and pixel read-backs off the
// main thread, so the map keeps rendering smoothly and its WebGL context is never shared with the model's.
/* global ort */
'use strict';
let engine = null;

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      importScripts(m.ortUrl); // vendored onnxruntime-web (WebGL-only build), same origin
      const { Engine } = await import(m.engineUrl);
      engine = await Engine.create({ ort: self.ort, modelUrl: m.modelUrl, sha256: m.sha256, size: m.size });
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
