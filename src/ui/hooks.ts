import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { DEFAULT_SETTINGS } from '../db/actions';
import { effectiveNow } from '../domain/srs';
import { countReady } from '../domain/selection';
import { pendingEggs } from '../domain/creatures';
import type { GameState, OwnedCreature, Settings } from '../domain/types';

export function useGame(): GameState | undefined {
  return useLiveQuery(() => db.game.get('main'), []);
}
export function useSettings(): Settings {
  return useLiveQuery(() => db.settings.get('main'), []) ?? DEFAULT_SETTINGS;
}
export function useCreatures(): OwnedCreature[] | undefined {
  return useLiveQuery(() => db.creatures.toArray(), []);
}
export function useActiveCreature(): OwnedCreature | undefined | null {
  const game = useGame();
  const creatures = useCreatures();
  if (!game || !creatures) return undefined;
  return creatures.find((c) => c.id === game.activeCreatureId) ?? creatures[0] ?? null;
}
export function usePendingEggs(): number {
  const game = useGame();
  return game ? pendingEggs(game.totalXp, game.eggsHatched) : 0;
}

/** Words that are ready to practise right now (due, new or being relearned). */
export function useReadyCount(): number {
  const game = useGame();
  const n = useLiveQuery(async () => {
    const [words, progress] = await Promise.all([db.words.toArray(), db.progress.toArray()]);
    const now = effectiveNow(new Date(), game?.lastSeenAt);
    return countReady(words, new Map(progress.map((p) => [p.wordId, p])), now);
  }, [game?.lastSeenAt]);
  return n ?? 0;
}

export function useSettingsEffects(settings: Settings) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.text = settings.textSize;
    root.classList.toggle('reduce-motion', settings.reduceMotion);
  }, [settings.textSize, settings.reduceMotion]);
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useSpeechOptions(settings: Settings) {
  return useMemo(
    () => ({ enabled: settings.speechEnabled, rate: settings.speechRate, accent: settings.accent }),
    [settings.speechEnabled, settings.speechRate, settings.accent],
  );
}

/** ISO week number, used to suggest a list name. */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
