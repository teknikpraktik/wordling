import { SPECIES } from '../domain/creatures';
import { CreatureArt, EggArt, SilhouetteArt } from './creatures/CreatureArt';
import type { Mood } from './creatures/parts';

/** Development-only art preview (/?gallery). Not part of the production bundle. */
export function Gallery() {
  const moods: Mood[] = ['idle', 'sleep', 'eat', 'pet'];
  return (
    <div style={{ padding: 12, background: '#FFF8EC', minHeight: '100vh' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {SPECIES.map((sp) =>
          ([1, 2, 3] as const).map((st) => (
            <div key={sp.id + st} style={{ width: 170, height: 170 }}>
              <CreatureArt species={sp.id} stage={st} />
            </div>
          )),
        )}
        {moods.map((m) => (
          <div key={m} style={{ width: 170, height: 170 }}>
            <CreatureArt species="fenna" stage={2} mood={m} />
          </div>
        ))}
        <div style={{ width: 170, height: 170 }}><EggArt crack={2} /></div>
        <div style={{ width: 170, height: 170 }}><SilhouetteArt species="glimmo" /></div>
      </div>
    </div>
  );
}
