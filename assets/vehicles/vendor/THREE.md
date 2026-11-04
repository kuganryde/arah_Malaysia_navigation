# Vendored 3D bundle

- Packages: three 0.170.0 (MIT) + assets/vehicles/vehicles-3d.mjs, built with esbuild into one IIFE
- File: vehicles3d.min.js, 567364 bytes
- SRI: sha384-Y/wSoL7wqDO6OYE/fTg488eSabqRSkSvM688W0ofI6kVZ6gVLI2vY1beCyw6Calg
- Rebuild: `npm ci && npm run vehicles:build` (pinned versions in package-lock.json)
- Loaded only when a trip starts.
