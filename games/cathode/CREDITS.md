# CATHODE: credits

Everything in CATHODE is procedural or CC0. These are the third-party files it ships.

## Textures: Poly Haven (CC0 1.0)
The PBR texture sets in `public/tex/` come from [Poly Haven](https://polyhaven.com), released under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain, no attribution required; we credit them anyway).
- **Downloaded:** the 1k JPG maps of each set.
- **Re-encoded:** with jpeg-js at quality 80–86 to cut the download.
- **Files per set:** `<id>_diff.jpg` (diffuse), `<id>_nor.jpg` (OpenGL normal) and `<id>_arm.jpg` (ambient occlusion, roughness and metalness).

| Files | Asset | Authors |
|---|---|---|
| `asphalt_02_*` | [Asphalt 02](https://polyhaven.com/a/asphalt_02) | Rob Tuytel |
| `concrete_pavement_*` | [Concrete Pavement](https://polyhaven.com/a/concrete_pavement) | Charlotte Baglioni |
| `concrete_wall_006_*` | [Concrete Wall 006](https://polyhaven.com/a/concrete_wall_006) | Dario Barresi, Charlotte Baglioni |
| `concrete_slab_wall_*` | [Concrete Slab Wall](https://polyhaven.com/a/concrete_slab_wall) | Dimitrios Savva |
| `dark_brick_wall_*` | [Dark Brick Wall](https://polyhaven.com/a/dark_brick_wall) | Dario Barresi, Dimitrios Savva |
| `brick_wall_02_*` | [Brick Wall 02](https://polyhaven.com/a/brick_wall_02) | Dimitrios Savva |
| `plastered_wall_04_*` | [Plastered Wall 04](https://polyhaven.com/a/plastered_wall_04) | Rob Tuytel |
| `corrugated_iron_02_*` | [Corrugated Iron 02](https://polyhaven.com/a/corrugated_iron_02) | Jenelle van Heerden, Sergej Majboroda |
| `rusty_metal_02_*` | [Rusty Metal 02](https://polyhaven.com/a/rusty_metal_02) | Rob Tuytel |
| `rusty_metal_shutter_*` | [Rusty Metal Shutter](https://polyhaven.com/a/rusty_metal_shutter) | Charlotte Baglioni |
| `metal_grate_rusty_*` | [Metal Grate Rusty](https://polyhaven.com/a/metal_grate_rusty) | Rob Tuytel, Dimitrios Savva |
| `wood_planks_grey_*` | [Wood Planks Grey](https://polyhaven.com/a/wood_planks_grey) | Rob Tuytel |
| `dirty_tiles_*` | [Dirty Tiles](https://polyhaven.com/a/dirty_tiles) | Matterfield, Jenelle van Heerden |

## Procedural
These are generated in code at load (`src/render/`), so there are no files to credit:
- the neon signs, window atlas, posters, decals, tarps, vending fronts and the billboard;
- the noise, rain, ripples, fog, sky and skyline.

Every name on a sign or poster is fictional.
