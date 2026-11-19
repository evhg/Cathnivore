# Plan item 515: the nine 3D towers told apart in black fill. Reads hedgerow-515-measure.mjs's masks-D.json (each
# tower drawn alone in black from the game camera, 48x48), saves them side by side as silhouettes-D.png and prints the
# most alike pairs by intersection over union (1 = the same shape).  Usage: python3 scripts/hedgerow-515-masks.py <dir>
import json, sys
from PIL import Image

out = sys.argv[1]
ms = json.load(open(f"{out}/masks-D.json"))
n = int(len(ms[0]["mask"]) ** 0.5)
img = Image.new("L", (n * len(ms) + 4 * (len(ms) - 1), n), 255)
for i, m in enumerate(ms):
    tile = Image.new("L", (n, n), 255)
    tile.putdata([0 if v else 255 for v in m["mask"]])
    img.paste(tile, (i * (n + 4), 0))
img.resize((img.width * 3, img.height * 3), Image.NEAREST).save(f"{out}/silhouettes-D.png")
pairs = []
for i in range(len(ms)):
    for j in range(i + 1, len(ms)):
        a, b = ms[i]["mask"], ms[j]["mask"]
        inter = sum(1 for x, y in zip(a, b) if x and y)
        union = sum(1 for x, y in zip(a, b) if x or y) or 1
        pairs.append((inter / union, ms[i]["kind"], ms[j]["kind"]))
pairs.sort(reverse=True)
print("order:", " ".join(m["kind"] for m in ms))
for iou, a, b in pairs[:5]:
    print(f"  {a:>9} ~ {b:<9} IoU {iou:.2f}")
