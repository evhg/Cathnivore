import { beforeAll, describe, expect, it } from 'vitest'
import * as THREE from 'three'

// Plan item 261: the title's wet ground. The sign's streak lies on the street between the sign and the lens and
// stutters with the tubes; the contact shadow and the sheen sit under her shoes. 3 meshes, so 3 draw calls.
beforeAll(() => {
  // No DOM under vitest here: the textures' canvases only need to exist.
  ;(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => null }) }
})

describe('front wet ground', () => {
  it('runs the streak from under the sign toward the lens, flat on the ground', async () => {
    const { buildFrontWet } = await import('../games/cathode/src/render/frontwet')
    const wet = buildFrontWet()
    const sign = new THREE.Vector3(-2, 1.6, 59.6)
    const cam = new THREE.Vector3(-3.3, 0.95, 54.9)
    wet.update(sign, 1.2, cam, 1, () => 0)
    const streak = wet.group.getObjectByName('front-wet-streak') as THREE.Mesh
    expect(streak.visible).toBe(true)
    expect(streak.position.y).toBeGreaterThan(0)
    expect(streak.position.y).toBeLessThan(0.05)
    // Between the sign and the lens on the ground plane.
    const toCam = Math.hypot(cam.x - streak.position.x, cam.z - streak.position.z)
    const toSign = Math.hypot(sign.x - streak.position.x, sign.z - streak.position.z)
    const span = Math.hypot(cam.x - sign.x, cam.z - sign.z)
    expect(toCam + toSign).toBeCloseTo(span, 1)
    // Never reaching the lens.
    expect(streak.scale.z).toBeLessThan(span)
    const lit = (streak.material as THREE.MeshBasicMaterial).color.r
    wet.update(sign, 1.2, cam, 0, () => 0)
    expect((streak.material as THREE.MeshBasicMaterial).color.r).toBeLessThan(lit * 0.5)
    const meshes: THREE.Object3D[] = []
    wet.group.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o))
    expect(meshes.length).toBe(3)
  })

  it('puts the contact shadow under her feet', async () => {
    const { buildFrontWet } = await import('../games/cathode/src/render/frontwet')
    const wet = buildFrontWet()
    wet.feet(new THREE.Vector3(-1.9, 0.2, 58.2), Math.PI)
    const shadow = wet.group.getObjectByName('front-wet-shadow') as THREE.Mesh
    expect(shadow.position.x).toBeCloseTo(-1.9)
    expect(shadow.position.z).toBeCloseTo(58.2)
    expect(shadow.position.y - 0.2).toBeGreaterThan(0)
    expect(shadow.position.y - 0.2).toBeLessThan(0.03)
  })
})
