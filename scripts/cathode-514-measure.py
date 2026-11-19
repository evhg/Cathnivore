# Plan item 514: how much of a class-pick frame is flat, untextured surface. Splits the shot into 20 px blocks, marks a
# block flat when its luminance varies by under 2.5 (standard deviation, 0-255), joins touching flat blocks, and prints
# the largest region as a share of the whole frame (the item's bar: none over 5%), plus all flat blocks' share.
# Usage: python3 scripts/cathode-514-measure.py [--box=x0,y0,x1,y1] shot.png [...]  (shots from the pick at
# ?front=classpick&shot&t=8; --box keeps to the stage between the page's columns, e.g. 480,60,960,880 at 1440x900;
# shares are still of the whole frame)
import statistics, sys
from PIL import Image

B = 20
box = None
files = []
for a in sys.argv[1:]:
    if a.startswith("--box="):
        box = tuple(int(v) for v in a[6:].split(","))
    else:
        files.append(a)
for f in files:
    im = Image.open(f).convert("L")
    W, H = im.size
    cols, rows = W // B, H // B
    flat = set()
    for j in range(rows):
        for i in range(cols):
            if box and not (box[0] <= i * B < box[2] and box[1] <= j * B < box[3]):
                continue
            if statistics.pstdev(list(im.crop((i * B, j * B, i * B + B, j * B + B)).getdata())) < 2.5:
                flat.add((i, j))
    seen, best = set(), 0
    for c in flat:
        if c in seen:
            continue
        stack, n = [c], 0
        seen.add(c)
        while stack:
            i, j = stack.pop()
            n += 1
            for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                k = (i + d[0], j + d[1])
                if k in flat and k not in seen:
                    seen.add(k)
                    stack.append(k)
        best = max(best, n)
    total = cols * rows
    print(f"{f}: largest flat region {100 * best / total:.1f}% of the frame, all flat {100 * len(flat) / total:.1f}%")
