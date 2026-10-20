import { pick, type Rng } from './rng';
import type { SpeciesId, Stage } from './types';

export interface SpeciesInfo {
  id: SpeciesId;
  name: string;
  trait: string;
  /** Primary / secondary / accent colours (also used by the SVG art). */
  palette: { main: string; light: string; dark: string; accent: string };
  stageNames: [string, string, string];
}

export const SPECIES: SpeciesInfo[] = [
  {
    id: 'moffi',
    name: 'Moffi',
    trait: 'Shy and cuddly. Smiles with its ears.',
    palette: { main: '#A8E6CF', light: '#D4F5E6', dark: '#6FC9A6', accent: '#FFB7B2' },
    stageNames: ['Baby Moffi', 'Moffi', 'Star Moffi'],
  },
  {
    id: 'tuffa',
    name: 'Tuffa',
    trait: 'Wise and sleepy. Loves to read.',
    palette: { main: '#C9B6F2', light: '#E5DAFA', dark: '#9C85D6', accent: '#FFE08A' },
    stageNames: ['Tuffa chick', 'Tuffa', 'Wise Tuffa'],
  },
  {
    id: 'fenna',
    name: 'Fenna',
    trait: 'Playful and curious. Chases its own tail.',
    palette: { main: '#FFC9A8', light: '#FFE3D0', dark: '#F2A074', accent: '#FFFFFF' },
    stageNames: ['Fenna pup', 'Fenna', 'Three-tail Fenna'],
  },
  {
    id: 'glimmo',
    name: 'Glimmo',
    trait: 'Brave little dragon. Puffs glittery bubbles.',
    palette: { main: '#FFE59A', light: '#FFF3C6', dark: '#F2C94C', accent: '#FF9E80' },
    stageNames: ['Hatchling Glimmo', 'Glimmo', 'Glitter Glimmo'],
  },
  {
    id: 'nuffa',
    name: 'Nuffa',
    trait: 'Calm snail friend. Takes things at its own pace.',
    palette: { main: '#9ADBE8', light: '#CBEFF5', dark: '#5FB7C9', accent: '#FFB7D5' },
    stageNames: ['Little Nuffa', 'Nuffa', 'Crystal Nuffa'],
  },
  {
    id: 'lumi',
    name: 'Lumi',
    trait: 'Dreamy light spirit. Floats and glows.',
    palette: { main: '#BFD3FF', light: '#E1EBFF', dark: '#8FAEF2', accent: '#FFF3A8' },
    stageNames: ['Spark Lumi', 'Lumi', 'Moon Lumi'],
  },
];

export const SPECIES_IDS = SPECIES.map((s) => s.id);
export const speciesInfo = (id: SpeciesId): SpeciesInfo => SPECIES.find((s) => s.id === id)!;

export const STAGE_GROWING_XP = 150;
export const STAGE_EVOLVED_XP = 500;

export function stageForXp(xp: number): Stage {
  if (xp >= STAGE_EVOLVED_XP) return 3;
  if (xp >= STAGE_GROWING_XP) return 2;
  return 1;
}

/** XP still missing for the next stage, or null for Evolved. */
export function xpToNextStage(xp: number): { next: Stage; remaining: number; target: number } | null {
  if (xp < STAGE_GROWING_XP) return { next: 2, remaining: STAGE_GROWING_XP - xp, target: STAGE_GROWING_XP };
  if (xp < STAGE_EVOLVED_XP) return { next: 3, remaining: STAGE_EVOLVED_XP - xp, target: STAGE_EVOLVED_XP };
  return null;
}

/** Accumulated XP at which the nth egg (0-based) unlocks. Beyond the sixth, extra eggs give cosmetic variants. */
const EGG_THRESHOLDS = [0, 250, 650, 1200, 1900, 2800];
export function eggThreshold(index: number): number {
  if (index < EGG_THRESHOLDS.length) return EGG_THRESHOLDS[index]!;
  return EGG_THRESHOLDS[EGG_THRESHOLDS.length - 1]! + 1500 * (index - EGG_THRESHOLDS.length + 1);
}

export function unlockedEggs(totalXp: number): number {
  let n = 0;
  while (eggThreshold(n) <= totalXp) n++;
  return n;
}

/** Eggs earned but not yet hatched. `hatched` = number of eggs already hatched (creatures + variants). */
export function pendingEggs(totalXp: number, hatched: number): number {
  return Math.max(0, unlockedEggs(totalXp) - hatched);
}

/** Next egg threshold the player is working towards. */
export function nextEggAt(hatchedPlusPending: number): number {
  return eggThreshold(hatchedPlusPending);
}

/** Random species the player does not own yet; null once the collection is complete. */
export function pickNewSpecies(owned: readonly SpeciesId[], rng: Rng): SpeciesId | null {
  const left = SPECIES_IDS.filter((s) => !owned.includes(s));
  return left.length ? pick(left, rng) : null;
}

export const VARIANT_COUNT = 4;
