// Plan item 588: the class pick's booking photos as noir stills of the 3D Cath. Item 575 drew them as the shared 2D
// cartoon bust (shared/cath), out of key with the street behind the pick. Here a second hero figure stands in a small
// private room of her own (never in the street's scene), indoors with the umbrella furled, and is dressed per class
// with the pick's own coat, kit, pose and face; one hard key from high on the lens's left throws half her face into
// shadow, a rim in the class's colour edges her from behind, and almost no fill. Each still is shot by the street's
// renderer into a small target and handed back as an image URL (the gun studio's way, render/gunportrait.ts), with a
// clear background so the photo's height chart and placard show through. The figure is built on the first shot and
// dropped after the fifth.
import * as THREE from "three";
import { buildFrontCath, type FaceExpression, type FrontCath } from "./frontcath";

/** A photo's size in device pixels (the rows show it at 64x78 u, 48 px wide or more). */
export const BOOKING_PHOTO = { width: 168, height: 204 };

export interface BookingLook {
  /** The class's coat colour (hex), or null for her black trench. */
  coat: number | null;
  /** The class's key (linear RGB): the photo's rim and her own rim's tint. */
  key: [number, number, number];
  /** Her face in the photo. */
  expression: FaceExpression;
}

/** Above her feet: where the lens aims (her chin) and how far back it stands for head and shoulders. */
const AIM_Y = 1.6;
const LENS = { x: 0.16, y: 1.64, z: 1.38, fov: 21 };
/** How long her pose is run in before the shot (s at 30 fps): long enough for the stance's blend to finish. */
const SETTLE_STEPS = 24;

export class BookingRoom {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(LENS.fov, BOOKING_PHOTO.width / BOOKING_PHOTO.height, 0.05, 20);
  private readonly cath: FrontCath;
  private readonly rim: THREE.DirectionalLight;
  private readonly target: THREE.WebGLRenderTarget;
  private readonly pixels: Uint8Array;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly image: ImageData;
  private t = 0;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    phone: boolean,
  ) {
    this.cath = buildFrontCath(phone);
    this.cath.indoors(true);
    this.scene.add(this.cath.group);
    this.camera.position.set(LENS.x, LENS.y, LENS.z);
    this.camera.lookAt(0, AIM_Y, 0);
    // The key: a hard spot high on the lens's left and a little ahead of her (her right cheek lit, the far side of
    // her face in shadow), inverse-square from close so it falls off down her coat.
    const key = new THREE.SpotLight(0xffecd6, 1, 0, 0.5, 0.35, 2);
    key.position.set(-1.15, 2.2, 0.55);
    key.target.position.set(0, AIM_Y + 0.05, 0);
    key.intensity = 3.2 * key.position.distanceToSquared(key.target.position);
    this.scene.add(key, key.target);
    // The rim in the class's colour from behind her other shoulder, and a whisper of cool fill so the shadow side keeps its shape.
    this.rim = new THREE.DirectionalLight(0xffffff, 5);
    this.rim.position.set(1.1, 2.2, -1.4);
    this.scene.add(this.rim, new THREE.HemisphereLight(0x8090a8, 0x060608, 0.12));

    const { width, height } = BOOKING_PHOTO;
    this.target = new THREE.WebGLRenderTarget(width, height, { samples: 4 });
    this.target.texture.colorSpace = THREE.SRGBColorSpace;
    this.pixels = new Uint8Array(width * height * 4);
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d")!;
    this.image = this.ctx.createImageData(width, height);
  }

  /** Dresses her as `cls` and returns the still's image URL. */
  shoot(cls: string, look: BookingLook): string {
    const { cath, renderer } = this;
    cath.coat(look.coat != null ? new THREE.Color(look.coat) : null);
    cath.kit(cls);
    cath.stance(cls, true);
    cath.expression(look.expression);
    cath.look(null, true);
    const keyColour = new THREE.Color(look.key[0], look.key[1], look.key[2]);
    this.rim.color.copy(keyColour);
    // Her own rim (the street's back light in her shader) toward the class light, as on the pick's stage.
    cath.tint(keyColour, 0.6);
    for (let i = 0; i < SETTLE_STEPS; i++) {
      this.t += 1 / 30;
      cath.update(1 / 30, this.t, { x: 0, z: 0 });
    }
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    cath.setRim(this.rim.position.clone().normalize().transformDirection(this.camera.matrixWorldInverse));

    const { width, height } = BOOKING_PHOTO;
    const prevTarget = renderer.getRenderTarget();
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    const prevAutoClear = renderer.autoClear;
    try {
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = true;
      renderer.setRenderTarget(this.target);
      renderer.render(this.scene, this.camera);
      renderer.readRenderTargetPixels(this.target, 0, 0, width, height, this.pixels);
    } finally {
      renderer.setRenderTarget(prevTarget);
      renderer.setClearColor(prevClear, prevAlpha);
      renderer.autoClear = prevAutoClear;
    }
    const row = width * 4;
    for (let y = 0; y < height; y++) this.image.data.set(this.pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
    this.ctx.putImageData(this.image, 0, 0);
    const url = this.canvas.toDataURL("image/webp", 0.88);
    return url.startsWith("data:image/webp") ? url : this.canvas.toDataURL("image/png");
  }

  dispose(): void {
    this.target.dispose();
    this.cath.dispose();
  }
}

const photos = new Map<string, string>();
let room: { r: BookingRoom; renderer: THREE.WebGLRenderer; left: Set<string> } | null = null;

/**
 * The booking photo for a class (cached), shot on first ask. `classes` are every class the pick will ask for: the
 * room is dropped once each has its photo.
 */
export function bookingPhoto(renderer: THREE.WebGLRenderer, phone: boolean, cls: string, look: BookingLook, classes: readonly string[]): string {
  const had = photos.get(cls);
  if (had) return had;
  if (!room || room.renderer !== renderer) {
    room?.r.dispose();
    room = { r: new BookingRoom(renderer, phone), renderer, left: new Set(classes) };
  }
  const url = room.r.shoot(cls, look);
  photos.set(cls, url);
  room.left.delete(cls);
  if (room.left.size === 0) {
    room.r.dispose();
    room = null;
  }
  return url;
}
