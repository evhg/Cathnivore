// The Drowned Market, act 1's hub street (docs/design/cathode.md §5, ROADMAP 65). This file wires the
// renderer together and implements the World contract in types.ts:
//   level.ts       the layout (geometry, colliders, markers, lights, signs, windows, vents, drips)
//   materials.ts   CC0 PBR + paints + HDR emissives          shading.ts   fog, light volume, wet surfaces
//   lighting.ts    baked light volume, streaming light pool  reflection.ts the planar wet-street mirror
//   signs.ts       the neon atlas and flicker                atmosphere.ts sky, skyline, rain, steam, shafts
//   fx.ts          muzzle flashes, impacts, blood, casings   post.ts      bloom, noir grade, FXAA, grain

import * as THREE from "three";
import type { CreateWorld, Quality, Surface, World, WorldEvent } from "./types";
import { installFog, createShared, patchMaterial, FLOOD } from "./shading";
import { loadPbr, noiseTexture, windowAtlas, WIN_COLS, WIN_ROWS, posterAtlas, POSTER_COUNT, shopInterior, vendingFront } from "./textures";
import { buildLevel, L, type Level } from "./level";
import { createMaterials } from "./materials";
import { bakeVolume, LightPool, hash1 } from "./lighting";
import { buildSigns } from "./signs";
import { buildAtmosphere, type AtmoUniforms } from "./atmosphere";
import { PlanarReflection, LAYER_NO_REFLECT } from "./reflection";
import { createFx } from "./fx";
import { createPost } from "./post";

interface Preset {
  pool: number;
  shadow: number;
  softShadow: boolean;
  reflScale: number;
  rain: number;
  splashes: number;
  drips: number;
  steam: number;
  skyline: number;
  shadowEvery: number;
}

const PRESETS: Record<Quality, Preset> = {
  phone: { pool: 12, shadow: 1024, softShadow: false, reflScale: 0.5, rain: 5000, splashes: 450, drips: 160, steam: 10, skyline: 90, shadowEvery: 2 },
  high: { pool: 32, shadow: 2048, softShadow: true, reflScale: 1, rain: 14000, splashes: 1300, drips: 420, steam: 18, skyline: 150, shadowEvery: 1 },
  ultra: { pool: 44, shadow: 4096, softShadow: true, reflScale: 1, rain: 22000, splashes: 2200, drips: 700, steam: 24, skyline: 200, shadowEvery: 1 },
};

/** Fog: a cold blue-grey haze, linear RGB. */
const FOG_COLOR = new THREE.Color(0.0042, 0.0058, 0.0095);
const FOG_DENSITY = 0.019;

export const createWorld: CreateWorld = async (canvas, options, onProgress) => {
  const quality = options.quality;
  const P = PRESETS[quality];
  const shot = options.shot === true;
  const progress = (s: number, label: string) => onProgress?.(s, label);
  progress(0.02, "Rain over the Drowned Market…");
  installFog();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false });
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = P.softShadow ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(FOG_COLOR.getHex(THREE.LinearSRGBColorSpace), FOG_DENSITY);
  (scene.fog as THREE.FogExp2).color.copy(FOG_COLOR);
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 1000);
  camera.layers.enable(LAYER_NO_REFLECT);
  const viewScene = new THREE.Scene();
  viewScene.add(new THREE.HemisphereLight(0x8899bb, 0x111111, 0.35));
  const viewCamera = new THREE.PerspectiveCamera(55, 16 / 9, 0.01, 10);

  const shared = createShared();
  shared.uNoise.value = noiseTexture();

  // ------------------------------------------------------------ assets and layout
  const pbr = await loadPbr(renderer, (d, t) => progress(0.05 + 0.5 * (d / t), d < t * 0.5 ? "Wet asphalt, cold brick…" : "Rust, tarps, fish on ice…"));
  progress(0.58, "Laying out the street…");
  await frame();
  const level = buildLevel(quality);
  const volMin = new THREE.Vector3(-26, -3, L.zSouth - 8);
  const volMax = new THREE.Vector3(34, 26, L.zNorth + 8);
  const volume = bakeVolume(level.lights, volMin, volMax, [0.75, 1.5, 1]);
  shared.uVolume.value = volume.texture;
  shared.uVolMin.value.copy(volMin);
  shared.uVolInvSize.value.set(1 / volume.size.x, 1 / volume.size.y, 1 / volume.size.z);
  shared.uVolGain.value = 1;
  progress(0.66, "Lighting the signs…");
  await frame();

  const materials = createMaterials(pbr, shared, quality);
  const statics = new THREE.Group();
  statics.name = "statics";
  const colliders = level.builder.colliders;
  const surfaces = level.builder.surfaces;
  level.builder.build(materials, statics, { shadows: true, layer: (k) => (k === "asphalt" || k === "pavement" ? LAYER_NO_REFLECT : 0) });
  scene.add(statics);
  addWater(scene, materials.water!);
  addWindows(scene, level, shared);
  addInteriors(scene, level);
  addPosters(scene, level, shared);
  const signs = buildSigns(level.signs);
  scene.add(signs.tubes, signs.boxes);

  // ------------------------------------------------------------ lights
  const hemi = new THREE.HemisphereLight(0x6f86b0, 0x0a0a0c, 0.06);
  scene.add(hemi);
  const key = new THREE.SpotLight(level.key.color, 1100, 110, Math.PI * 0.16, 0.55, 2);
  key.position.copy(level.key.pos);
  key.target.position.copy(level.key.target);
  key.castShadow = true;
  key.shadow.mapSize.set(P.shadow, P.shadow);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 120;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 3;
  scene.add(key, key.target);
  const lightning = new THREE.DirectionalLight(0xc8d8ff, 0);
  lightning.position.set(-40, 80, -60);
  scene.add(lightning);
  const pool = new LightPool(scene, level.lights, P.pool, 0.7);

  // ------------------------------------------------------------ atmosphere
  const keyDir = level.key.target.clone().sub(level.key.pos).normalize();
  const atmoU: AtmoUniforms = {
    uTime: shared.uTime,
    uCam: { value: new THREE.Vector3() },
    uWind: { value: new THREE.Vector2(1.6, 0.4) },
    uVolume: shared.uVolume,
    uVolMin: shared.uVolMin,
    uVolInvSize: shared.uVolInvSize,
    uKeyPos: { value: level.key.pos.clone() },
    uKeyDir: { value: keyDir },
    uKeyCos: { value: Math.cos(Math.PI * 0.16) },
    uKeyColor: { value: level.key.color.clone().multiplyScalar(0.05) },
    uLightning: shared.uLightning,
    uNoise: shared.uNoise,
    uShelterMin: { value: level.shelters[0]!.min.clone() },
    uShelterMax: { value: level.shelters[0]!.max.clone() },
  };
  const atmo = buildAtmosphere(
    {
      rain: P.rain,
      splashes: P.splashes,
      drips: level.drips,
      dripCount: P.drips,
      vents: level.vents,
      steamPer: P.steam,
      cones: level.cones,
      skyline: P.skyline,
      fogColor: FOG_COLOR,
    },
    atmoU,
  );
  scene.add(atmo.group);
  const wind = { x: atmoU.uWind.value.x, z: atmoU.uWind.value.y };

  // ------------------------------------------------------------ effects
  const listeners = new Set<(e: WorldEvent) => void>();
  const emit = (e: WorldEvent) => listeners.forEach((l) => l(e));
  const fxs = createFx({ scene, shared, intensity: options.intensity, quality, colliders, surfaces, groundHeight: level.groundHeight, volume, emit });

  // ------------------------------------------------------------ reflection and post
  const reflection = new PlanarReflection(0, P.reflScale);
  shared.uRefl.value = reflection.target.texture;
  shared.uReflMatrix.value = reflection.matrix;
  const post = createPost(renderer, scene, camera, viewScene, viewCamera, quality);

  // ------------------------------------------------------------ environment (neon reflections for the game's materials)
  progress(0.8, "Neon in the puddles…");
  await frame();
  const start = level.markers.player![0]!;
  camera.position.set(start.x, start.y + 1.6, start.z);
  camera.updateMatrixWorld();
  pool.update(camera, 0, 1, true);
  {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const probe = new THREE.Vector3(-1, 3.5, 22);
    scene.position.copy(probe).negate();
    atmo.sky.position.copy(probe);
    scene.updateMatrixWorld(true);
    const env = pmrem.fromScene(scene, 0.02, 0.1, 950);
    scene.position.set(0, 0, 0);
    scene.updateMatrixWorld(true);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();
  }
  progress(0.9, "Compiling shaders…");
  await frame();
  renderer.shadowMap.needsUpdate = true;
  try {
    await renderer.compileAsync(scene, camera);
  } catch {
    renderer.compile(scene, camera);
  }

  // ------------------------------------------------------------ the frame
  let drama = 0;
  let lightningT = shot ? Infinity : 6 + Math.random() * 8;
  let flash = 0;
  const flashes: Array<{ at: number; k: number }> = [];
  let clock = 0;
  let frameNo = 0;
  const perf = { renderMs: 0, drawCalls: 0, triangles: 0 };
  const tmp = new THREE.Vector3();
  const lum = new THREE.Color();
  const ray = new THREE.Ray();
  const hit = new THREE.Vector3();

  const world: World & { perf: typeof perf } = {
    renderer,
    scene,
    camera,
    colliders,
    markers: level.markers,
    viewScene,
    viewCamera,
    fx: fxs.fx,
    wind,
    perf,
    groundHeight: (x, z) => level.groundHeight(x, z),
    floorAt(x, y, z) {
      let best = level.groundHeight(x, z);
      for (const c of colliders) {
        if (x < c.min.x || x > c.max.x || z < c.min.z || z > c.max.z) continue;
        if (c.max.y <= y + 0.5 && c.max.y > best) best = c.max.y;
      }
      return best;
    },
    lightAt(p) {
      // The baked neon around the point, the key floodlight if it can see the point, and live flashes.
      volume.sample(tmp.set(p.x, p.y + 0.8, p.z), lum);
      let l = lum.r * 0.2126 + lum.g * 0.7152 + lum.b * 0.0722;
      const toKey = tmp.copy(level.key.pos).sub(p);
      const dist = toKey.length();
      toKey.divideScalar(dist);
      const cosA = -toKey.dot(keyDir);
      if (cosA > Math.cos(Math.PI * 0.16)) {
        ray.set(p.clone().add(new THREE.Vector3(0, 0.9, 0)), toKey);
        let blocked = false;
        for (const c of colliders)
          if (ray.intersectBox(c, hit) && hit.distanceTo(ray.origin) < dist - 1) {
            blocked = true;
            break;
          }
        if (!blocked) l += (1100 / (dist * dist)) * 0.1 * THREE.MathUtils.smoothstep(cosA, Math.cos(Math.PI * 0.16), Math.cos(Math.PI * 0.12));
      }
      for (const fl of fxs.lights) if (fl.intensity > 0) l += (fl.intensity / (1 + fl.position.distanceToSquared(p))) * 0.004;
      // Calibrated: under a streetlamp ~0.75, open street ~0.15–0.3, the alleys' back corners 0.
      return THREE.MathUtils.clamp(1 - Math.exp(-l * 20), 0, 1);
    },
    surfaceAt(p) {
      let best: Surface | null = null;
      let bestVol = Infinity;
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i]!;
        if (p.x < c.min.x - 0.06 || p.x > c.max.x + 0.06 || p.y < c.min.y - 0.06 || p.y > c.max.y + 0.06 || p.z < c.min.z - 0.06 || p.z > c.max.z + 0.06) continue;
        const v = (c.max.x - c.min.x) * (c.max.y - c.min.y) * (c.max.z - c.min.z);
        if (v < bestVol) {
          bestVol = v;
          best = surfaces[i]!;
        }
      }
      if (best) return best;
      const g = level.groundHeight(p.x, p.z);
      if (g < FLOOD.water + 0.01 || (p.x > L.quayEdge && p.x < L.canalE)) return "water";
      return "concrete";
    },
    update(dt, time) {
      clock = time;
      shared.uTime.value = time;
      signs.uniforms.uTime.value = time;
      atmo.update(camera, time);
      pool.update(camera, dt, time, shot || dt === 0);
      fxs.update(dt, camera);
      // Lightning: two or three quick pulses, then thunder a few seconds later.
      lightningT -= dt;
      if (lightningT <= 0) {
        lightningT = 9 + Math.random() * 16;
        const strength = 0.5 + Math.random() * 0.5;
        const base = time;
        const pulses = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < pulses; i++) flashes.push({ at: base + i * (0.07 + Math.random() * 0.12), k: strength * (i === 0 ? 0.6 : 1) });
        emit({ type: "thunder", strength, delay: 1 + Math.random() * 3.5 });
      }
      flash = 0;
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i]!;
        const age = time - f.at;
        if (age < 0) continue;
        if (age > 0.25) {
          flashes.splice(i, 1);
          continue;
        }
        flash = Math.max(flash, f.k * Math.exp(-age * 18));
      }
      shared.uLightning.value = flash;
      lightning.intensity = flash * 2.2;
      hemi.intensity = 0.06 + flash * 0.5;
      // The floodlight hums and sways a hair in the wind.
      key.intensity = 1100 * (0.97 + 0.03 * Math.sin(time * 37 + hash1(Math.floor(time * 3))));
    },
    render() {
      const t0 = performance.now();
      renderer.info.reset();
      frameNo++;
      if (frameNo % P.shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
      camera.updateMatrixWorld();
      reflection.render(renderer, scene, camera);
      post.grade.uniforms.uDrama!.value = drama;
      post.grade.uniforms.uFlash!.value = flash * 0.25;
      post.render(clock);
      perf.renderMs = performance.now() - t0;
      perf.drawCalls = renderer.info.render.calls;
      perf.triangles = renderer.info.render.triangles;
    },
    resize(width, height, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = viewCamera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      viewCamera.updateProjectionMatrix();
      post.setSize(width, height, pixelRatio);
      reflection.setSize(width * pixelRatio, height * pixelRatio);
    },
    setDrama(amount) {
      drama = THREE.MathUtils.clamp(amount, 0, 1);
    },
    wetten(material, wetness = 0.5) {
      patchMaterial(material, shared, { kind: "prop", wet: wetness });
      material.needsUpdate = true;
    },
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      fxs.dispose();
      reflection.dispose();
      post.composer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      for (const m of Object.values(materials)) m.dispose();
      renderer.dispose();
    },
  };
  // Not part of the contract: a handle for screenshot and tuning scripts.
  Object.assign(world, { debug: { post, reflection, pool, shared, key, volume } });
  progress(1, "Ready");
  return world;
};

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** The canal and the flooded stretch: one water material, depth-faded at the shore. */
function addWater(scene: THREE.Scene, mat: THREE.Material): void {
  const canal = new THREE.Mesh(new THREE.PlaneGeometry(L.canalE - L.quayEdge, L.zNorth - L.zSouth + 20), mat);
  canal.rotation.x = -Math.PI / 2;
  canal.position.set((L.quayEdge + L.canalE) / 2, FLOOD.water, (L.zNorth + L.zSouth) / 2);
  const flood = new THREE.Mesh(new THREE.PlaneGeometry(L.quayEdge - L.roadW + 0.2, FLOOD.zNear - FLOOD.zFar + 2), mat);
  flood.rotation.x = -Math.PI / 2;
  flood.position.set((L.quayEdge + L.roadW) / 2, FLOOD.water, (FLOOD.zNear + FLOOD.zFar) / 2);
  for (const m of [canal, flood]) {
    m.layers.set(LAYER_NO_REFLECT);
    m.receiveShadow = true;
    m.renderOrder = 1;
    m.name = "water";
    scene.add(m);
  }
}

/** Every window in the district: one instanced draw, tiles picked from the atlas per instance. */
function addWindows(scene: THREE.Scene, level: Level, shared: ReturnType<typeof createShared>): void {
  const atlas = windowAtlas();
  const mat = new THREE.MeshStandardMaterial({
    map: atlas.map,
    emissiveMap: atlas.emissive,
    emissive: new THREE.Color(1, 1, 1),
    emissiveIntensity: 1,
    roughness: 0.1,
    metalness: 0.0,
  });
  patchMaterial(mat, shared, { kind: "prop", wet: 0.2, volume: 0.6 });
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    base.call(mat, shader, r);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aWin;\nvarying float vWinLit;")
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
        vec2 cTile = vec2( mod( aWin.x, ${WIN_COLS}.0 ), floor( aWin.x / ${WIN_COLS}.0 ) );
        vec2 cUv = ( uv + cTile * vec2( 1.0, -1.0 ) + vec2( 0.0, ${WIN_ROWS - 1}.0 ) ) / vec2( ${WIN_COLS}.0, ${WIN_ROWS}.0 );
        vMapUv = cUv;
        vEmissiveMapUv = cUv;
        vWinLit = aWin.y;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vWinLit;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vWinLit;");
  };
  mat.customProgramCacheKey = () => "cathode-windows";
  const geo = new THREE.PlaneGeometry(1, 1);
  const n = level.windows.length;
  const attr = new Float32Array(n * 2);
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const z = new THREE.Vector3(0, 0, 1);
  level.windows.forEach((w, i) => {
    q.setFromUnitVectors(z, w.normal);
    m.compose(w.pos, q, new THREE.Vector3(w.w, w.h, 1));
    mesh.setMatrixAt(i, m);
    attr[i * 2] = w.tile;
    attr[i * 2 + 1] = w.lit;
  });
  geo.setAttribute("aWin", new THREE.InstancedBufferAttribute(attr, 2));
  mesh.name = "windows";
  mesh.frustumCulled = false;
  scene.add(mesh);
}

/** Lit shop interiors behind the glass (and under half-open shutters). */
function addInteriors(scene: THREE.Scene, level: Level): void {
  for (const it of level.interiors) {
    const tex = shopInterior(it.seed, it.tint);
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(2.2, 2.2, 2.2) });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(it.w, it.h), mat);
    mesh.position.copy(it.pos);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), it.normal);
    mesh.name = "interior";
    scene.add(mesh);
  }
  for (const v of level.vending) {
    const mat = new THREE.MeshBasicMaterial({ map: vendingFront(v.title, v.hue), color: new THREE.Color(2.6, 2.6, 2.6) });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.7), mat);
    mesh.position.copy(v.pos);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v.normal);
    mesh.name = "vending";
    scene.add(mesh);
  }
}

/** Posters and graffiti: merged quads over one atlas. */
function addPosters(scene: THREE.Scene, level: Level, shared: ReturnType<typeof createShared>): void {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const up = new THREE.Vector3();
  const right = new THREE.Vector3();
  for (const p of level.posters) {
    up.set(0, 1, 0);
    right.crossVectors(up, p.normal).normalize();
    const cu = (p.idx % 4) / 4;
    const cv = 1 - (Math.floor(p.idx / 4) + 1) / 2;
    const corners = [
      [-0.5, -0.5, 0, 0],
      [0.5, -0.5, 1, 0],
      [0.5, 0.5, 1, 1],
      [-0.5, 0.5, 0, 1],
    ] as const;
    const v = corners.map(([x, y, a, b]) => ({
      p: p.pos.clone().addScaledVector(right, x * p.w).addScaledVector(up, y * p.h).addScaledVector(p.normal, 0.015),
      uv: [cu + a / 4, cv + b / 2],
    }));
    for (const i of [0, 1, 2, 0, 2, 3]) {
      pos.push(v[i]!.p.x, v[i]!.p.y, v[i]!.p.z);
      nor.push(p.normal.x, p.normal.y, p.normal.z);
      uv.push(v[i]!.uv[0]!, v[i]!.uv[1]!);
    }
  }
  void POSTER_COUNT;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  const mat = new THREE.MeshStandardMaterial({ map: posterAtlas(), roughness: 0.6, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  patchMaterial(mat, shared, { kind: "wall", wet: 0.7 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = "posters";
  mesh.receiveShadow = true;
  scene.add(mesh);
}
