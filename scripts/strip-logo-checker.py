#!/usr/bin/env python3
"""
Strip the transparency-indicator checkerboard out of Logo-RLSPS.png.

The export pipeline saved the logo as RGB (no alpha) and baked the
designer-tool checkerboard into actual pixels. We sample colours from the
four corners (which are guaranteed checkerboard cells), then turn every
pixel matching either of those colours within a small tolerance into a
fully transparent pixel. Anti-aliased edges between the artwork and the
checkerboard get a partial alpha so the silhouette stays crisp.

Usage: python strip-logo-checker.py <in.png> <out.png>
"""
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGBA")
w, h = img.size
px = img.load()

# Sample 4 corner pixels — two from each checker shade.
samples = [
    px[0, 0][:3],
    px[w - 1, 0][:3],
    px[0, h - 1][:3],
    px[w - 1, h - 1][:3],
    # Step inwards by a typical checker square (~16-24 px) to grab the
    # alternating colour.
    px[24, 0][:3],
    px[0, 24][:3],
]
bg_colors = list({s for s in samples})
print(f"Detected checker colours: {bg_colors}", file=sys.stderr)

TOL = 6  # per-channel tolerance for an exact-checker match → full transparency
EDGE_TOL = 28  # broader tolerance to fade anti-aliased pixels


def channel_distance(c, target):
    return max(abs(a - b) for a, b in zip(c, target))


def alpha_for(rgb):
    best = min(channel_distance(rgb, t) for t in bg_colors)
    if best <= TOL:
        return 0           # fully transparent — this IS the checker
    if best <= EDGE_TOL:
        # Soft fade for anti-aliased pixels at the artwork's silhouette.
        return int(255 * (best - TOL) / (EDGE_TOL - TOL))
    return 255             # fully opaque — this is the artwork


out_pixels = []
for r, g, b, _a in img.getdata():
    out_pixels.append((r, g, b, alpha_for((r, g, b))))

img.putdata(out_pixels)
img.save(dst, "PNG", optimize=True)
print(f"Wrote {dst}", file=sys.stderr)
