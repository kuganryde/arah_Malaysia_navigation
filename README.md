<div align="center">

<img src="assets/arah-logo-512.png" alt="ARAH logo: a neon navigation arrow above the word ARAH" width="220">

<img src="assets/arah-banner.svg" alt="ARAH · Navigasi Malaysia: animated route line with voice guidance in Bahasa Malaysia, English, Chinese and Tamil" width="100%">

**A free 3D low-poly navigation map for Malaysian roads, with turn-by-turn voice in Bahasa Malaysia, English, 中文 and தமிழ்.**

![Status: Beta](https://img.shields.io/badge/status-beta-ff7a2f?style=flat-square&labelColor=0a0c1a)
![Non-profit](https://img.shields.io/badge/100%25-non--profit-1fe0a8?style=flat-square&labelColor=0a0c1a)
![No tracking](https://img.shields.io/badge/no-tracking-2fd0ec?style=flat-square&labelColor=0a0c1a)
![Map: MapLibre GL](https://img.shields.io/badge/map-MapLibre%20GL%205-4f6bff?style=flat-square&labelColor=0a0c1a)
![Deploy: Vercel](https://img.shields.io/badge/deploy-Vercel-a865f5?style=flat-square&labelColor=0a0c1a)
![Voice: BM · EN · 中文 · தமிழ்](https://img.shields.io/badge/voice-BM%20·%20EN%20·%20中文%20·%20தமிழ்-ec4899?style=flat-square&labelColor=0a0c1a)

<img src="assets/arah-divider.svg" alt="" width="100%">

</div>

## What is ARAH?

**ARAH** (Malay for *direction*) is a web-based navigation app built for the way Malaysians drive and ride. It draws the country as a 3D low-poly map with recognisable landmarks, finds routes with toll estimates in **RM**, searches for **surau, R&R, EV chargers, fuel and food** along the way, and speaks every instruction in your own language.

It is a **100% non-profit beta** by **Rydetech Global Enterprise**: free, no ads, no accounts, no tracking. Your location and the reports you file stay on your device.

> **Beta release.** Always follow road signs and local traffic laws. ARAH's route times and toll figures are estimates.

<div align="center">
<img src="assets/arah-features.svg" alt="ARAH features: 3D map, voice guide, toll in RM, along the route, live reports, weather ETA, offline, private" width="100%">
</div>

---

## Features

### 🗺️ Four map looks

| Mode | Malay · English | What you get |
| --- | --- | --- |
| Night | **Malam** · Neon night | The signature look: a dark circuit-board ground lit by a cyan route line |
| Day | **Siang** · Daylight | Bright map with a blue route line and white casing |
| Satellite | **Satelit** · Satellite + labels | Esri World Imagery with place labels |
| Terrain | **Rupa bumi** · 3D terrain | Real elevation (×1.4 exaggeration) so highlands and Gunung Kinabalu stand up |

An **Auto siang / malam** option switches between day and night for you. On the map: toggle 3D, reset north, jump to **my location**, change map views, or file a report.

### 🏙️ 3D low-poly landmarks

Twelve low-poly landmarks you can tap for a short spoken guide, height and city:

Menara Berkembar Petronas · Merdeka 118 · Menara Kuala Lumpur · Masjid Negara · Bangunan Sultan Abdul Samad · Batu Caves · Masjid Putra · Komtar · Menara Alor Setar · A Famosa · Bangunan DUN Sarawak · Gunung Kinabalu

Start from one of **nine cities**: Kuala Lumpur, George Town, Melaka, Putrajaya, Johor Bahru, Ipoh, Kota Kinabalu, Kuching and Langkawi.

### 🧭 Routing that fits Malaysia

- **Search** places with *Cari tempat · Search Malaysia*, set a start (*Titik mula*) and destination (*Destinasi*), and swap them with one tap.
- **Alternative routes** with distance, time and **toll estimates in RM**.
- **Elak tol** (avoid tolls) and **Elak lebuh raya** (avoid highways) switches.
- **Depart time** (*Bertolak · Depart*): arrival estimates adjust for time-of-day congestion in Malaysia time and for forecast rain, weighted by how urban the route is.
- **Save your route** and reload it later, even with no signal.

### 🔊 Voice guidance in four languages

| Language | Guide voice | Sample |
| --- | --- | --- |
| Bahasa Malaysia | Gemini voice via `/api/tts`, speaks the sentence as written | “Belok kiri di hadapan.” |
| English | Gemini voice via `/api/tts`, speaks the sentence as written | “Turn left ahead.” |
| 中文 | Your device's voice | “前方左转。” |
| தமிழ் | Your device's voice | “முன்னால் இடதுபுறம் திரும்புங்கள்.” |

Next-step previews read *Kemudian · Then · 然后 · பிறகு*. Landmark and place guides speak in the language you pick, and a **Dengar panduan · Listen to guide** button replays it.

### 🎥 AR driver assist (Beta)

Turn on **AR** (top-left of the map) and two small windows appear while you navigate: a live camera view with detection boxes, and a data card. The AI (**YOLOX-nano**, running on your phone's **WebGL**) works entirely on the device. No video is uploaded, recorded or saved.

| Reads | How |
| --- | --- |
| **Hazards** | Cars, buses, trucks, motorcycles, pedestrians, cyclists, animals, traffic lights (red/amber/green) and stop signs |
| **Distance** | Estimated from apparent size, to the vehicle in your lane |
| **Following gap** | Seconds behind the lead vehicle (the two-second rule) and time-to-collision from how fast the gap closes |
| **Speed** | Your speed from GPS, and the lead vehicle's approximate speed |
| **Lane** | Position in the lane, drift warning and lane-change detection (lane lines found with image processing) |

Alerts appear in the data card in Bahasa Malaysia, English, 中文 or தமிழ், with a short beep and vibration for danger. The windows can be dragged and enlarged. The camera stops when you close AR, and AR that started with a trip stops when the trip ends.

> **Assistance only.** Estimates come from one phone camera (about ±25%) and need a phone mounted level in a holder with a clear view of the road. Never hold the phone while driving. The model sees common road users, not potholes, debris or flooding; those need a custom-trained model (see `assets/ar/models/MODEL.md`).

### 📍 Along-the-route search

Eight groups, powered by OpenStreetMap through Overpass:

| Group | Finds |
| --- | --- |
| **Tarikan** | Attractions, museums, viewpoints, theme parks, zoos |
| **Minyak** | Fuel stations |
| **EV** | Charging stations |
| **Surau / Masjid** | Muslim prayer places |
| **R&R** | Highway rest areas and services |
| **Makan** | Restaurants, food courts, fast food |
| **Tandas** | Toilets |
| **Parkir** | Parking |

### ⚠️ Community road reports

File a report from the map and ARAH announces it when it is within 500 m ahead (*Di hadapan*). Each type fades out when it is likely to be stale.

| Report | Malay · English | Stays for |
| --- | --- | --- |
| 🚗 | **Kesesakan** · Traffic jam | 3 h |
| 💥 | **Kemalangan** · Accident | 3 h |
| 🌊 | **Banjir kilat** · Flash flood | 8 h |
| 🚧 | **Kerja jalan** · Roadworks | 72 h |
| 🕳️ | **Jalan berlubang** · Pothole / debris | 48 h |
| 🚓 | **Sekatan polis** · Police block | 3 h |
| ⛔ | **Sekatan jalan raya** · Roadblock / road closed | 12 h |
| ⛰️ | **Tanah runtuh** · Landslide | 72 h |
| ☂️ | **Tempat berteduh** · Rider rain shelter | stays |

Reports are stored on your device only. The sample reports shown on first launch are labelled *sample*.

### 🌦️ Weather and rain awareness

Forecast rain from **Open-Meteo** nudges arrival estimates up when it is heavy, and a weather line shows conditions for your trip.

### 📴 Offline ready

Map tiles you have viewed and your saved route are cached on the device, so *Luar talian · Offline* still shows your map and route. Fresh routing needs a connection.

### 🌴 Explore Malaysia

- All **16 states and federal territories**, with capitals and flags.
- **18 tourist highlights** including Langkawi Sky Bridge, Taman Negara, Cameron Highlands, Genting Highlands, Kek Lok Si Temple, Gunung Mulu Caves, Sepilok Orangutan Centre, Sipadan Island, Danum Valley, Bako National Park, Taiping Lake Gardens and Kuala Selangor Fireflies.

<div align="center"><img src="assets/arah-divider.svg" alt="" width="100%"></div>

## 🔒 Privacy and transparency

- **100% non-profit.** Free, no ads, sells nothing.
- **No personal information collected.** No accounts, no tracking.
- **On-device storage.** Preferences, last map view, saved route and reports live in your browser's local storage; map tiles live in the browser cache.
- **The only text sent to a server of ours** is the sentence to be spoken, to `/api/tts` (600 characters at most).
- **Location** is requested only for the app itself (`Permissions-Policy: geolocation=(self)`).
- **Camera** is used only if you turn on AR driver assist; frames are analysed on the device and never leave it (`Permissions-Policy: camera=(self)`).

## 🏗️ How it works

```mermaid
flowchart LR
  U[Driver / rider<br/>browser] --> A[ARAH app<br/>static site]
  A --> M[MapLibre GL 5<br/>3D map + terrain]
  M --> OF[OpenFreeMap<br/>vector tiles]
  M --> ES[Esri imagery<br/>satellite]
  M --> AW[AWS terrarium<br/>elevation]
  A --> OS[OSRM<br/>routing]
  A --> PH[Photon<br/>place search]
  A --> OV[Overpass<br/>nearby places]
  A --> OM[Open-Meteo<br/>forecast]
  A -->|text to speak| T[/api/tts<br/>Vercel function/]
  T --> G[Gemini TTS<br/>BM + English]
  A --> D[(Device storage<br/>prefs · route · reports · tiles)]
```

| Layer | Choice |
| --- | --- |
| App | Single self-contained `index.html`, built from an editable Design Component source |
| Map | MapLibre GL 5, 3D low-poly landmark layer, terrain exaggeration 1.4 |
| Routing | OSRM with alternatives, toll and highway exclusion |
| Search | Photon (geocoding), Overpass (nearby places) |
| Weather | Open-Meteo forecast |
| Voice | Gemini TTS function for BM and English; device speech for 中文 and தமிழ் |
| AR | YOLOX-nano on onnxruntime-web (WebGL), classical lane detection, all on-device |
| Icons | Phosphor Icons 2.1.1 |
| Hosting | Vercel (static site plus one serverless function) |

## 🎨 Design: Nocturne

ARAH uses the **Nocturne** neon design system: a circuit-board night ground lit by the Rydetech logo spectrum.

| Token | Value | Use |
| --- | --- | --- |
| `color-bg` | `#0a0c1a` | App ground |
| `color-surface` | `#141729` | Cards, inputs, dialogs |
| `color-text` | `#eef0fa` | Primary text |
| `color-accent` | `#a865f5` | Primary line, focus, links (neon violet) |
| `color-accent-2` | `#2fd0ec` | Route line, kickers (neon cyan) |
| Neon spectrum | `#1fe0a8` `#2fd0ec` `#4f6bff` `#a865f5` `#ec4899` `#ff7a2f` | Lines, glows, gradients, in logo order |

Type: **Barlow Condensed** (headings, 800 italic uppercase), **Ubuntu** (body), **JetBrains Mono** (numbers and kickers). Radii 4, 8 and 14 px.

## 📁 Repository

```
.
├── index.html        # the self-contained app (site root)
├── api/tts.js        # optional Vercel function for the Gemini voice
├── assets/ar/        # AR driver assist: UI, logic, YOLOX model, WebGL runtime
├── source/           # editable Design Component source
├── assets/           # logo and README art
└── vercel.json       # clean URLs + geolocation permissions policy
```

## 🚀 Deploy

1. Push this folder to GitHub, then import the repo in Vercel (framework **Other**, no build command).
2. For the Gemini voice, set environment variables:

   | Variable | Required | Purpose |
   | --- | --- | --- |
   | `GEMINI_API_KEY` | yes | Authenticates the TTS function (keep it in Vercel's secret store, never in the repo) |
   | `GEMINI_TTS_MODEL` | no | Override the speech model |
   | `GEMINI_TTS_VOICE` | no | Override the voice name |
   | `TTS_STYLE` | no | Optional short tone hint (max 80 chars) placed before the sentence. Empty by default, so only the sentence is read |

   Without a key the app still works: voice falls back to the device's own speech.
3. In Vercel, open **Settings → Deployment Protection** and disable protection to make the site public, then assign your domain.

## 🙏 Credits and data

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors · [OpenFreeMap](https://openfreemap.org) · [OSRM](https://project-osrm.org) · [Photon](https://photon.komoot.io) · [Overpass API](https://overpass-api.de) · [Open-Meteo](https://open-meteo.com) · Esri World Imagery · [MapLibre GL](https://maplibre.org) · [Phosphor Icons](https://phosphoricons.com).

<div align="center">

<img src="assets/rydetech-logo.png" alt="Rydetech Global Enterprise logo" width="96">

**Designed and built by [Rydetech Global Enterprise](https://rydetechglobal.com)**
[rydetechwizsolutions@proton.me](mailto:rydetechwizsolutions@proton.me)

<sub>BETA · Always follow road signs and local traffic laws.</sub>

</div>
