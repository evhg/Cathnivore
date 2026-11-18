"""Plan item 506: the share of a 3D field shot that reads as bare lilac-grey bed (the 'paving' the critique saw):
pixels a pinkish grey (red and blue a touch over green, low saturation, mid value). Usage: python3 scripts/hedgerow-506-measure.py shot.png [...]
Optional --box=x0,y0,x1,y1 (default: the 1440x900 3D field's frame, 14,74-1080,888)."""
import sys
from PIL import Image

box = (14, 74, 1080, 888)
files = []
for a in sys.argv[1:]:
    if a.startswith("--box="): box = tuple(int(v) for v in a[6:].split(","))
    else: files.append(a)
for f in files:
    im = Image.open(f).convert("RGB").crop(box)
    im = im.resize((im.width // 2, im.height // 2))
    px = list(im.getdata())
    n = sum(1 for r, g, b in px if r - g >= 6 and b - g >= 1 and abs(r - b) <= 22 and max(r, g, b) - min(r, g, b) <= 40 and 115 <= (r + g + b) / 3 <= 195)
    print(f, f"lilac-grey {100 * n / len(px):.2f}%")
