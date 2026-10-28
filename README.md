# ARAH · Navigasi Malaysia (Beta)

3D low-poly navigation map for Malaysia. Beta by Rydetech Global Enterprise. Non-profit, no personal data collected.

- `index.html` – the self-contained app (served as the site root)
- `api/tts.js` – optional Vercel function for Gemini voice (BM/English). Chinese/Tamil use the device voice.
- `source/` – editable Design Component source

## Deploy
1. Push this folder to GitHub, then import the repo in Vercel (framework: Other, no build command).
2. For the Gemini voice, set env vars: `GEMINI_API_KEY` (required), `GEMINI_TTS_MODEL`, `GEMINI_TTS_VOICE` (optional).
3. In Vercel → Settings → Deployment Protection, disable protection to make the site public; assign your domain.

## Data
Map data © OpenStreetMap contributors · OpenFreeMap · OSRM · Photon · Overpass · Open-Meteo · Esri imagery.
