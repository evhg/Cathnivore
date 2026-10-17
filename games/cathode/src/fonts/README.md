# CATHODE fonts

`cathode-figures-latin-wght.woff2` is JetBrains Mono (variable, 100-800), cut to the ten digits, with the dot
taken out of the zero: the HUD's big counts want clean figure zeros (docs/design/aaa-ui.md). Renamed "Cathode
Figures" per the OFL (`OFL-JetBrainsMono.txt`). The other faces load straight from `node_modules/@fontsource*`.

Rebuilt with fontTools: drop contour 3 (points 32-43) of `zero` and the same points from its `gvar` deltas,
then subset to U+0030-0039 as woff2.
