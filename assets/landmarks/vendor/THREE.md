# Vendored 3D bundle

- Packages: three 0.170.0 (MIT) + assets/landmarks/*.mjs (original models and procedural textures), built with esbuild into one IIFE
- File: landmarks3d.min.js, 500044 bytes
- SRI: sha384-obe0grfYcEIhBSU3oq5oDdx81ROHzR3rtRHJVAhv1wzHiCmqCMEsc5IZbqqnrKYn
- Rebuild: `npm ci && npm run landmarks:build` (pinned versions in package-lock.json)
- Loaded only when the map first looks at a landmark.
