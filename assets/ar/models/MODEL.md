# AR detection model

| | |
| --- | --- |
| Model | YOLOX-nano, 416x416, 80 COCO classes |
| Source | https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_nano.onnx |
| Licence | Apache-2.0 (see `LICENSE-YOLOX.txt`) |
| Original SHA-256 | `c789161ed43c8269fcd4e67c67eeeb4e80c622da2eb296a20bc6007bd18a0b7d` |
| Shipped file | `yolox_nano.onnx` |
| Shipped SHA-256 | `c8f3da2770dd570ad2569ec159712f00a9e901557c680071860df1d28c94b4a3` |
| Runtime | onnxruntime-web 1.22.0, WebGL backend only (`../vendor/ort.webgl.min.js`, MIT) |

The browser refuses to run any model whose SHA-256 differs from the value pinned in `../arah-ar.js`.
`npm run check` fails if this table, the pinned value and the file disagree.

## What was changed from the original

The WebGL backend cannot load three things the official file uses, so `scripts/ar/webgl_compat.py` rewrites them. Weights are untouched.

1. The Focus stem (8 strided Slice nodes + Concat) becomes one Conv with a one-hot 2x2 kernel and stride 2.
2. The two 2x nearest-neighbour Resize nodes become depthwise ConvTranspose with a 2x2 all-ones kernel and stride 2.
3. int64 constants become int32.

Rewrites 1 and 2 were verified bit-identical (max difference 0.0) against the original on random input with onnxruntime (CPU).
To regenerate: `python3 scripts/ar/webgl_compat.py yolox_nano.onnx out.onnx`, then update the hash in this file and `arah-ar.js`.

## What it can and cannot see

COCO has people, bicycles, cars, motorcycles, buses, trucks, animals, traffic lights and stop signs. It does **not** have
potholes, debris, flooding, lane markings or traffic-light state. Lanes are found with classical image processing
(`ar-core.mjs`, `detectLanes`); traffic-light colour is read from the pixels inside the detected box. Road-surface
hazards need a model trained for them.

## Using a different or custom model (for example potholes)

Export a YOLOX model with the same output layout (`[1, 3549, 5 + classes]`, objectness and class scores already sigmoided,
xy/wh raw), run it through `webgl_compat.py`, put it here, and update `MODEL` in `arah-ar.js` (`url`, `sha256`) and the
class lists in `ar-core.mjs`. Larger models (for example `yolox_tiny`, 20 MB) are more accurate but slower on phones.
