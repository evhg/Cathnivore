// Shader warm-up without freezing the page (owner, 2026-11-02: "10 seconds to show anything ... then an
// unresponsive popup from Chrome").
//
// three compiles a material's program the first time it draws, and the first use waits for the driver to finish
// it on the main thread. The street needs about 80 programs, and the ones that matter are variants: the mirror
// pass draws into a half-float target, the HDR scene pass into its own, the reflection probe with no tone mapping.
// A plain compileAsync(scene, camera) compiles the on-screen variant, which this game never draws, so every real
// program still compiled mid-frame and the title froze for seconds.
//
// compileFrame runs one real frame with renderer.render swapped for a recorder: every pass sets its render target,
// clipping and tone mapping exactly as it will when drawing, so each recorded call carries the state of the variant
// the real frame needs. Then:
//  - with KHR_parallel_shader_compile (Chrome on macOS, Windows and Android) everything is queued at once and the
//    driver compiles it all in parallel off the main thread; we only poll until it is done;
//  - without it (Safari, Firefox, software GL) every link waits on the main thread, and the GPU works through its
//    queue in order, so a batch makes the first wait as long as all of them. Objects are compiled one at a time
//    instead, each in its own task: the page keeps painting and never reads as hung.

import * as THREE from "three";

interface Call {
  scene: THREE.Object3D;
  camera: THREE.Camera;
  target: THREE.WebGLRenderTarget | null;
  toneMapping: THREE.ToneMapping;
  clipping: THREE.Plane[];
  localClipping: boolean;
  /** A full-screen quad swaps its material between draws (bloom's blur levels): the one it drew with. */
  material?: THREE.Material | THREE.Material[];
}

type Program = { isReady?: () => boolean; getUniforms?: () => unknown };
const task = () => new Promise<void>((r) => setTimeout(r, 0));

/** Compile `scene` as it draws into an off-screen HDR target (the reflection probe's cube faces). */
export async function compileOffscreen(renderer: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera): Promise<void> {
  const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  try {
    await compileCalls(renderer, [{ scene, camera, target, toneMapping: THREE.NoToneMapping, clipping: [], localClipping: false }]);
  } finally {
    target.dispose();
  }
}

export async function compileFrame(renderer: THREE.WebGLRenderer, drawOnce: () => void): Promise<void> {
  const calls: Call[] = [];
  const real = renderer.render;
  renderer.render = function (scene: THREE.Object3D, camera: THREE.Camera): void {
    calls.push({
      scene,
      camera,
      target: renderer.getRenderTarget(),
      toneMapping: renderer.toneMapping,
      clipping: renderer.clippingPlanes.slice(),
      localClipping: renderer.localClippingEnabled,
      material: (scene as THREE.Mesh).isMesh ? (scene as THREE.Mesh).material : undefined,
    });
  } as typeof renderer.render;
  try {
    drawOnce();
  } finally {
    renderer.render = real;
  }
  await compileCalls(renderer, calls);
}

async function compileCalls(renderer: THREE.WebGLRenderer, calls: Call[]): Promise<void> {
  const parallel = !!renderer.extensions.get("KHR_parallel_shader_compile");
  const programs = () => (renderer.info.programs ?? []) as unknown as Program[];
  const saved = {
    target: renderer.getRenderTarget(),
    toneMapping: renderer.toneMapping,
    clipping: renderer.clippingPlanes,
    localClipping: renderer.localClippingEnabled,
  };
  const apply = (c: Call) => {
    renderer.setRenderTarget(c.target);
    renderer.toneMapping = c.toneMapping;
    renderer.clippingPlanes = c.clipping;
    renderer.localClippingEnabled = c.localClipping;
  };
  const restore = () => {
    renderer.setRenderTarget(saved.target);
    renderer.toneMapping = saved.toneMapping;
    renderer.clippingPlanes = saved.clipping;
    renderer.localClippingEnabled = saved.localClipping;
  };
  const compile = (scene: THREE.Object3D, camera: THREE.Camera, target?: THREE.Object3D, material?: Call["material"]) => {
    const mesh = scene as THREE.Mesh;
    const was = mesh.material;
    if (material) mesh.material = material;
    try {
      renderer.compile(scene, camera, (target as THREE.Scene | undefined) ?? null);
    } catch {
      // Something compile() can't take: it compiles on its first real draw instead.
    } finally {
      if (material) mesh.material = was;
    }
  };

  if (parallel) {
    for (const c of calls) {
      apply(c);
      compile(c.scene, c.camera, undefined, c.material);
    }
    restore();
    const t0 = performance.now();
    while (performance.now() - t0 < 20_000 && !programs().every((p) => p.isReady?.() ?? true)) {
      await new Promise((r) => setTimeout(r, 16));
    }
    return;
  }

  // One renderable at a time, finishing its programs before the next is queued.
  let done = programs().length;
  for (const c of calls) {
    // One object per distinct program (its material, plus the per-object features that change the shader):
    // compile() scans the scene's lights on every call, so calling it for every mesh of a big street is slow.
    const items: THREE.Object3D[] = [];
    const keys = new Set<string>();
    c.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (!m) return;
      const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      const mats = Array.isArray(m) ? m : [m];
      const key = [
        mats.map((x) => x.uuid).join(","),
        (o as THREE.SkinnedMesh).isSkinnedMesh ? "s" : "",
        (o as THREE.InstancedMesh).isInstancedMesh ? "i" : "",
        (o as THREE.Points).isPoints ? "p" : (o as THREE.Line).isLine ? "l" : (o as THREE.Sprite).isSprite ? "sp" : "",
        g?.attributes.color ? "c" : "",
        g?.attributes.tangent ? "t" : "",
        g?.attributes.uv1 ? "u1" : "",
        Object.keys(g?.morphAttributes ?? {}).length,
        o.receiveShadow ? "r" : "",
      ].join("|");
      if (keys.has(key)) return;
      keys.add(key);
      items.push(o);
    });
    for (const o of items) {
      apply(c);
      compile(o, c.camera, c.scene, o === c.scene ? c.material : undefined);
      restore();
      const list = programs();
      if (list.length === done) continue;
      for (; done < list.length; done++) list[done]!.getUniforms?.();
      await task();
    }
  }
}

