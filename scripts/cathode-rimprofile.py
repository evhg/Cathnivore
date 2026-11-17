# Plan item 463: reads cathode-rimprofile.mjs's shots. For each row the coat mask spans 40 px or more, the outer
# 2 px of coat on each side (their brightest) against the mean of the cloth 6-14 px inside; prints, per side, the
# median lift and the share of rows lifted 10+ luma.   python3 -I scripts/cathode-rimprofile.py <dir>
import sys
from PIL import Image
d = sys.argv[1] if len(sys.argv) > 1 else '.'
for name in ('D', 'P'):
    try:
        im = Image.open(f'{d}/rim-{name}.png').convert('L')
        mk = Image.open(f'{d}/rim-{name}-mask.png').convert('RGB')
    except FileNotFoundError:
        continue
    w, h = im.size
    lifts = {'left': [], 'right': []}
    for y in range(h):
        xs = [x for x in range(w) if (lambda p: p[1] > 120 and p[1] > p[0] + 50 and p[1] > p[2] + 50)(mk.getpixel((x, y)))]
        if len(xs) < 40:
            continue
        xl, xr = xs[0], xs[-1]
        if xr - xl < 40:
            continue
        for side, edge, inner in (('left', range(xl, xl + 2), range(xl + 6, xl + 14)), ('right', range(xr - 1, xr + 1), range(xr - 13, xr - 5))):
            e = max(im.getpixel((x, y)) for x in edge)
            c = sum(im.getpixel((x, y)) for x in inner) / len(inner)
            lifts[side].append(e - c)
    out = []
    for side, v in lifts.items():
        if not v:
            out.append(f'{side}: no rows')
            continue
        s = sorted(v)
        out.append(f'{side}: rows {len(v)}, median lift {s[len(s)//2]:.1f}, lifted 10+ {100*sum(1 for x in v if x >= 10)/len(v):.0f}%')
    print(name, ' | '.join(out))
