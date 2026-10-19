import { useState } from 'react';
import { db } from '../db/db';
import { setActiveCreature } from '../db/actions';
import { SPECIES, eggThreshold, speciesInfo, xpToNextStage } from '../domain/creatures';
import type { OwnedCreature } from '../domain/types';
import { playSfx } from '../audio/sfx';
import { CreatureArt, EggArt, SilhouetteArt } from './creatures/CreatureArt';
import { EggIcon } from './Icons';
import { useCreatures, useGame, usePendingEggs } from './hooks';

const STAGE = { 1: 'Bebis', 2: 'Växande', 3: 'Fullt utvecklad' } as const;

export function CreaturesScreen({ onHatch }: { onHatch: () => void }) {
  const creatures = useCreatures();
  const game = useGame();
  const eggs = usePendingEggs();
  const [detail, setDetail] = useState<OwnedCreature | null>(null);
  if (!creatures || !game) return <div className="screen" />;
  const owned = new Map(creatures.map((c) => [c.species, c]));
  const nextAt = eggThreshold(game.eggsHatched + eggs);

  return (
    <div className="screen">
      <h1 className="h1 mb-1">Mina figurer</h1>
      <p className="muted font-bold mb-4">{creatures.length} av {SPECIES.length} hittade</p>

      {eggs > 0 && (
        <button type="button" className="btn btn-peach w-full mb-4" onClick={onHatch}>
          <EggIcon width="26" height="26" /> Nytt ägg! Kläck det
        </button>
      )}

      <div className="grid2">
        {SPECIES.map((sp) => {
          const c = owned.get(sp.id);
          if (!c) {
            return (
              <div key={sp.id} className="cc" style={{ cursor: 'default' }} aria-label="Ännu inte hittad figur">
                <div className="art"><SilhouetteArt species={sp.id} /></div>
                <span className="font-extrabold muted">???</span>
                <span className="text-xs font-bold muted">Dold figur</span>
              </div>
            );
          }
          const active = game.activeCreatureId === c.id;
          return (
            <button key={sp.id} type="button" className={`cc ${active ? 'active' : ''}`} onClick={() => setDetail(c)} aria-label={`${sp.name}, ${STAGE[c.stage]}${active ? ', din kompis just nu' : ''}`}>
              {active && <span className="badge">Kompis</span>}
              <div className="art"><CreatureArt species={c.species} stage={c.stage} variant={c.variant} noShadow label={sp.name} /></div>
              <span className="font-black text-lg">{sp.name}</span>
              <span className="text-xs font-extrabold muted">{STAGE[c.stage]} · {c.xp} XP</span>
            </button>
          );
        })}
      </div>

      {creatures.length < SPECIES.length && (
        <div className="card mt-5 flex items-center gap-3">
          <div className="w-14 h-14 shrink-0"><EggArt color="#E9E0FB" /></div>
          <p className="font-bold">
            {game.totalXp >= nextAt ? 'Ett ägg väntar!' : `Nästa ägg kommer vid ${nextAt} poäng. Du har ${game.totalXp}.`}
          </p>
        </div>
      )}

      {detail && <Detail creature={creatures.find((c) => c.id === detail.id) ?? detail} active={game.activeCreatureId === detail.id} onClose={() => setDetail(null)} />}
    </div>
  );
}

function Detail({ creature, active, onClose }: { creature: OwnedCreature; active: boolean; onClose: () => void }) {
  const info = speciesInfo(creature.species);
  const next = xpToNextStage(creature.xp);
  const choose = async () => {
    await setActiveCreature(db, creature.id);
    playSfx('pet');
    onClose();
  };
  return (
    <div className="sheet-back" onClick={onClose} role="presentation">
      <div className="sheet text-center" role="dialog" aria-modal="true" aria-label={info.name} onClick={(e) => e.stopPropagation()}>
        <div className="w-56 h-56 mx-auto"><CreatureArt species={creature.species} stage={creature.stage} variant={creature.variant} mood="happy" label={info.name} /></div>
        <h2 className="h1">{info.name}</h2>
        <p className="font-extrabold muted">{info.stageNames[creature.stage - 1]}</p>
        <p className="font-bold my-2">{info.trait}</p>
        <p className="font-extrabold">{creature.xp} XP{next ? ` · ${next.remaining} kvar till nästa nivå` : ' · Fullt utvecklad'}</p>
        <div className="flex gap-3 mt-4">
          <button type="button" className="btn btn-primary flex-1" onClick={choose} disabled={active}>
            {active ? 'Din kompis just nu' : `Välj ${info.name}`}
          </button>
          <button type="button" className="btn btn-soft" onClick={onClose}>Stäng</button>
        </div>
      </div>
    </div>
  );
}
