# Plan item 486: lane-to-plot luminance contrast from hedgerow-486-measure.mjs's shots (WCAG relative luminance,
# the median of 5x5 patches at the projected cell centres that fall inside the canvas).
import json, statistics, sys
from PIL import Image

def lum(rgb):
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb[:3]
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)

out = sys.argv[1]
rep = json.load(open(f"{out}/measure.json"))
for key, r in rep.items():
    im = Image.open(r["shot"]).convert("RGB")
    x0, y0, w, h = r["canvas"]
    def sample(pts):
        vals = []
        for p in pts:
            if not p or not (x0 + 3 <= p[0] < x0 + w - 3 and y0 + 3 <= p[1] < y0 + h - 3):
                continue
            patch = [lum(im.getpixel((int(p[0]) + dx, int(p[1]) + dy))) for dx in range(-2, 3) for dy in range(-2, 3)]
            vals.append(statistics.median(patch))
        return statistics.median(vals) if vals else None
    a, b = sample(r["lane"]), sample(r["plots"])
    ratio = (max(a, b) + 0.05) / (min(a, b) + 0.05) if a is not None and b is not None else None
    print(f"{key}: lane {a and round(a, 3)} plots {b and round(b, 3)} contrast {ratio and round(ratio, 2)} depots inside {[round(v, 2) for v in r['depotsInside']]}")
