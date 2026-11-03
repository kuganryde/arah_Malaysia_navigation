#!/usr/bin/env python3
"""Build the PWA icon set and iOS splash images from assets/arah-logo.png (needs Pillow).

  python3 scripts/pwa/make-icons.py

Outputs (committed, so the deploy needs no build step):
  assets/icons/icon-192.png, icon-512.png            "any" icons (Android, desktop)
  assets/icons/icon-maskable-512.png                 mark inside the 80% safe zone for adaptive-icon masks
  assets/icons/apple-touch-icon.png (180)            iOS home screen (full bleed; iOS rounds the corners)
  assets/icons/favicon-48.png
  assets/splash/launch-<w>x<h>.png                   iOS launch images (portrait)
The logo's grey-blue background is shifted to the app's ground colour so icons and the app share one dark.
"""
from PIL import Image
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(ROOT, 'assets', 'arah-logo.png')
BG = (10, 12, 26)  # --color-bg #0a0c1a
LOGO_BG = (30, 37, 45)  # sampled background of the supplied logo

logo = Image.open(SRC).convert('RGB')

def regrade(im):
    """Move the logo's own background to the app ground colour, keeping the neon glow (it is additive light)."""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = px[x, y]
            px[x, y] = tuple(max(0, min(255, c - l + t)) for c, l, t in zip((r, g, b), LOGO_BG, BG))
    return im

# The arrow + route mark, without the wordmark below it (the wordmark is unreadable at icon sizes).
_m = regrade(logo.crop((376, 298, 660, 562)).copy())  # arrow + route only; stops above the wordmark's glow
mark = Image.new('RGB', (320, 320), BG)
mark.paste(_m, ((320 - _m.width) // 2, (320 - _m.height) // 2))
# The full lockup (mark + ARAH) for launch images.
lockup = regrade(logo.crop((215, 285, 805, 725)).copy())

def tile(size, fill):
    """Square icon: the mark centred on the ground colour, occupying `fill` of the edge."""
    im = Image.new('RGB', (size, size), BG)
    s = int(size * fill)
    m = mark.resize((s, s), Image.LANCZOS)
    im.paste(m, ((size - s) // 2, (size - s) // 2))
    return im

out = os.path.join(ROOT, 'assets', 'icons')
tile(512, 0.9).save(os.path.join(out, 'icon-512.png'), optimize=True)
tile(192, 0.9).save(os.path.join(out, 'icon-192.png'), optimize=True)
tile(512, 0.66).save(os.path.join(out, 'icon-maskable-512.png'), optimize=True)  # keeps the mark well inside the 80% safe circle
tile(180, 0.88).save(os.path.join(out, 'apple-touch-icon.png'), optimize=True)
tile(48, 0.96).save(os.path.join(out, 'favicon-48.png'), optimize=True)

# iOS launch images: (width, height) in device pixels, portrait.
SPLASH = [(1290, 2796), (1179, 2556), (1284, 2778), (1170, 2532), (1125, 2436), (828, 1792), (750, 1334), (1242, 2208), (1668, 2388), (2048, 2732)]
sp = os.path.join(ROOT, 'assets', 'splash')
for w, h in SPLASH:
    im = Image.new('RGB', (w, h), BG)
    lw = int(min(w, h) * 0.62)
    l = lockup.resize((lw, int(lw * lockup.height / lockup.width)), Image.LANCZOS)
    im.paste(l, ((w - l.width) // 2, (h - l.height) // 2 - int(h * 0.02)))
    im.save(os.path.join(sp, f'launch-{w}x{h}.png'), optimize=True)
print('ok')
