// Plan item 464: what a test shot on the class pick sounds and looks like, per class. The voice is the class
// signature gun's own pre-rendered set (GunSound keys its recipes by weapon class, not by Cath's class: passing
// "ghost" found no recipe and every test shot fell back to the rack's click); the flash wears the class colour.
import { CLASS_SIGNATURE } from "../sim/character";
import type { ClassId } from "../sim/types";
import { WEAPON_BASES } from "../sim/weapons";

export interface TestFireLook {
  /** GunSound's recipe id: the signature gun's weapon class. */
  voice: string;
  /** The flash's HDR tint (multiplies the muzzle's white-hot core and orange streaks). */
  flash: [number, number, number];
  /** The muzzle's size, by the gun. */
  size: number;
}

const FLASH: Record<ClassId, [number, number, number]> = {
  ghost: [0.75, 0.95, 1.35], // a cold blue-white crack
  butcher: [1.3, 0.75, 0.45], // a fat sodium-orange bloom
  gunslinger: [1.25, 1.05, 0.55], // brass gold
  wirewitch: [1.1, 0.55, 1.35], // violet
  fixer: [0.8, 1.3, 0.6], // a chemical green
};

const SIZE: Record<string, number> = { sniper: 1.2, shotgun: 1.4, revolver: 0.95, launcher: 1.6, smart: 0.65 };

export function testFireLook(cls: ClassId): TestFireLook {
  const voice = WEAPON_BASES[CLASS_SIGNATURE[cls]]?.cls ?? "pistol";
  return { voice, flash: FLASH[cls] ?? [1, 1, 1], size: SIZE[voice] ?? 0.8 };
}
