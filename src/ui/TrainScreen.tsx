import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { advanceSession, startSession, submitAnswer } from '../db/actions';
import { fillBlank } from '../domain/cloze';
import { speciesInfo } from '../domain/creatures';
import type { Session } from '../domain/types';
import { playSfx } from '../audio/sfx';
import { speak, speechSupported } from '../audio/speech';
import { CreatureArt } from './creatures/CreatureArt';
import { BerryIcon, CheckIcon, CloseIcon, EggIcon, SpeakerIcon, StarIcon } from './Icons';
import { useActiveCreature, useReadyCount, useSettings, useSpeechOptions } from './hooks';

interface Props {
  onExit: () => void;
  onHatch: () => void;
  onImport: () => void;
}

export function TrainScreen({ onExit, onHatch, onImport }: Props) {
  const active = useLiveQuery(() => db.sessions.where('status').equals('active').first(), [], 'loading' as const);
  const [finished, setFinished] = useState<Session | null>(null);

  if (finished) return <Summary session={finished} onExit={onExit} onHatch={onHatch} />;
  if (active === 'loading') return <div className="train" />;
  if (active) return <QuestionView key={`${active.id}:${active.queue[active.index]?.qid}`} session={active} onExit={onExit} onFinished={setFinished} />;
  return <Idle onExit={onExit} onImport={onImport} onFinished={setFinished} />;
}

/* -------------------------------------------------------------------------- */

function Idle({ onExit, onImport }: { onExit: () => void; onImport: () => void; onFinished: (s: Session) => void }) {
  const ready = useReadyCount();
  const creature = useActiveCreature();
  const wordCount = useLiveQuery(() => db.words.count(), []);
  const started = useLiveQuery(() => db.progress.filter((p) => p.state !== 'NEW').count(), []) ?? 0;
  const [busy, setBusy] = useState(false);
  const [empty, setEmpty] = useState(false);

  const begin = async (extra: boolean) => {
    setBusy(true);
    const s = await startSession(db, { extra });
    setBusy(false);
    if (!s) setEmpty(true);
  };

  return (
    <div className="train items-center text-center">
      <div className="w-full flex justify-start">
        <button type="button" className="icon-btn" onClick={onExit} aria-label="Back"><CloseIcon width="24" height="24" /></button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        {creature && (
          <div className="w-56 h-56">
            <CreatureArt species={creature.species} stage={creature.stage} variant={creature.variant} mood="idle" label={speciesInfo(creature.species).name} />
          </div>
        )}
        {wordCount === 0 ? (
          <>
            <h1 className="h1">No words yet</h1>
            <p className="muted font-bold">Add this week’s words and we can start.</p>
            <button type="button" className="btn btn-primary" onClick={onImport}>Add words</button>
          </>
        ) : ready > 0 ? (
          <>
            <h1 className="h1">Ready to train?</h1>
            <p className="muted font-bold">A round takes a few minutes.</p>
            <button type="button" className="btn btn-primary btn-big" onClick={() => begin(false)} disabled={busy}>Start</button>
          </>
        ) : (
          <>
            <h1 className="h1">All done for today!</h1>
            <p className="muted font-bold max-w-xs">Words come back when it is time to review them.</p>
            {started > 0 && (
              <button type="button" className="btn btn-soft mt-2" onClick={() => begin(true)} disabled={busy}>
                Extra practice (no rewards)
              </button>
            )}
          </>
        )}
        {empty && <p className="font-bold muted" role="status">There is nothing to practise right now.</p>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function QuestionView({ session, onExit, onFinished }: { session: Session; onExit: () => void; onFinished: (s: Session) => void }) {
  const settings = useSettings();
  const speech = useSpeechOptions(settings);
  const creature = useActiveCreature();
  const item = session.queue[session.index]!;
  const answered = session.answers[item.qid];
  const word = useLiveQuery(() => db.words.get(item.wordId), [item.wordId]);
  const [text, setText] = useState('');
  const busy = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!answered && item.mode === 'typed') inputRef.current?.focus();
  }, [item.qid, answered, item.mode]);
  useEffect(() => {
    if (answered) nextRef.current?.focus();
  }, [answered]);
  useEffect(() => {
    if (answered?.evolved) playSfx('evolve');
  }, [answered?.evolved]);

  if (!word) return <div className="train" />;

  const submit = async (answer: string) => {
    if (busy.current || answered) return;
    busy.current = true;
    try {
      const { result } = await submitAnswer(db, session.id, item.qid, answer);
      if (result.correct) playSfx('correct');
      if (result.xp > 0) window.setTimeout(() => playSfx('reward'), 220);
    } finally {
      busy.current = false;
    }
  };

  const next = async () => {
    const s = await advanceSession(db, session.id, item.qid);
    if (s.status === 'done') onFinished(s);
  };

  const total = session.queue.length;
  const pct = Math.round(((session.index + (answered ? 1 : 0)) / total) * 100);
  const isLast = session.index === total - 1;

  return (
    <div className="train">
      <div className="flex items-center gap-3">
        <button type="button" className="icon-btn" onClick={onExit} aria-label="Save and stop for now"><CloseIcon width="24" height="24" /></button>
        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
          <i style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm font-extrabold muted" aria-label={`Question ${session.index + 1} of ${total}`}>{session.index + 1}/{total}</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pt-4 pb-2 flex flex-col gap-3">
        <div>
          <p className="muted font-extrabold">
            {item.mode === 'choice' ? 'What is it in English?' : item.mode === 'cloze' ? 'Which English word is missing from the sentence?' : 'Write it in English'}
          </p>
          <h1 className="q-word" lang="sv">{word.sv}</h1>
        </div>

        {item.mode === 'cloze' && item.prompt && (
          <p className="q-sentence" lang="en" data-testid="cloze-sentence">
            {answered ? fillBlank(item.prompt, answered.expected) : item.prompt}
          </p>
        )}

        {item.mode === 'choice' ? (
          <ul className="flex flex-col gap-3 list-none p-0 m-0" aria-label="Answer options">
            {item.options!.map((opt) => {
              const isRight = !!answered && opt === word.en;
              const isWrongPick = !!answered && !answered.correct && opt === answered.answer;
              return (
                <li key={opt}>
                  <button
                    type="button"
                    lang="en"
                    className={`choice ${isRight ? 'right' : ''} ${isWrongPick ? 'wrong' : ''}`}
                    disabled={!!answered}
                    onClick={() => submit(opt)}
                  >
                    <span className="flex-1">{opt}</span>
                    {isRight && <CheckIcon width="26" height="26" style={{ color: 'var(--color-mint-d)' }} />}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(text);
            }}
            className="flex flex-col gap-3"
          >
            <label htmlFor="answer" className="sr-only">Your answer in English</label>
            <input
              id="answer"
              ref={inputRef}
              className="field"
              style={{ fontSize: '1.35rem', fontWeight: 800 }}
              value={answered ? answered.answer : text}
              onChange={(e) => setText(e.target.value)}
              readOnly={!!answered}
              lang="en"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              placeholder="Type here…"
            />
            {!answered && (
              <div className="flex gap-3">
                <button type="submit" className="btn btn-primary flex-1" disabled={!text.trim()}>Answer</button>
                <button type="button" className="btn btn-soft" onClick={() => submit('')}>I don’t know</button>
              </div>
            )}
          </form>
        )}

        {answered && (
          <div className={`feedback ${answered.correct ? 'good' : answered.verdict === 'typo' ? 'near' : 'miss'}`} role="status" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <div>
                {answered.correct ? (
                  <p className="text-lg">Correct!</p>
                ) : answered.verdict === 'typo' ? (
                  <p>Almost! Spell it like this: <span lang="en" className="text-xl">{answered.expected}</span></p>
                ) : (
                  <p>Correct answer: <span lang="en" className="text-xl">{answered.expected}</span></p>
                )}
                {answered.reasked && !answered.correct && <p className="text-sm mt-1 font-bold">We will practise it again soon.</p>}
                {answered.reasked && answered.correct && <p className="text-sm mt-1 font-bold">Soon you will get to write it yourself.</p>}
                {answered.evolved && creature && (
                  <p className="mt-1">{speciesInfo(creature.species).name} has evolved!</p>
                )}
              </div>
              {speechSupported() && (
                <button type="button" className="icon-btn shrink-0" aria-label={`Listen to ${answered.expected}`} onClick={() => speak(item.mode === 'cloze' && item.prompt ? fillBlank(item.prompt, answered.expected) : answered.expected, { ...speech, enabled: true })}>
                  <SpeakerIcon width="26" height="26" style={{ color: 'var(--color-lav-d)' }} />
                </button>
              )}
            </div>
            {(answered.xp > 0 || answered.food > 0) && (
              <p className="gain mt-2" aria-label={`You got ${answered.xp} points and ${answered.food} food`}>
                <span className="inline-flex items-center gap-1"><StarIcon width="20" height="20" style={{ color: '#b07d00' }} />+{answered.xp}</span>
                <span className="inline-flex items-center gap-1"><BerryIcon width="20" height="20" style={{ color: '#d6456b' }} />+{answered.food}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {answered && (
        <button ref={nextRef} type="button" className="btn btn-primary btn-big w-full" onClick={next}>
          {isLast ? 'Done' : 'Next'}
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Summary({ session, onExit, onHatch }: { session: Session; onExit: () => void; onHatch: () => void }) {
  const settings = useSettings();
  const speech = useSpeechOptions(settings);
  const creature = useActiveCreature();
  const s = session.summary!;
  useEffect(() => {
    if (s.xp > 0) playSfx('reward');
  }, [s.xp]);

  const evolution = s.evolutions[s.evolutions.length - 1];
  return (
    <div className="train">
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center text-center gap-3 pt-4">
        {creature && (
          <div className="w-52 h-52 shrink-0">
            <CreatureArt species={creature.species} stage={creature.stage} variant={creature.variant} mood="play" label={speciesInfo(creature.species).name} />
          </div>
        )}
        <h1 className="h1">Well done!</h1>
        <p className="text-xl font-extrabold">{s.correct} of {s.total} correct</p>

        {!session.extra && (
          <div className="flex gap-3 justify-center flex-wrap">
            <span className="chip" aria-label={`${s.xp} points`}><StarIcon width="22" height="22" style={{ color: '#b07d00' }} />+{s.xp}</span>
            <span className="chip" aria-label={`${s.food} food`}><BerryIcon width="22" height="22" style={{ color: '#d6456b' }} />+{s.food}</span>
          </div>
        )}
        {session.extra && <p className="muted font-bold">Extra practice – no rewards this time.</p>}

        {evolution && creature && (
          <div className="feedback good w-full">
            {speciesInfo(creature.species).name} has grown to the next level!
          </div>
        )}
        {s.newEggs > 0 && (
          <button type="button" className="btn btn-peach w-full" onClick={onHatch}>
            <EggIcon width="26" height="26" /> You have a new egg! Hatch it
          </button>
        )}

        {s.needsPractice.length > 0 && (
          <div className="card w-full text-left">
            <h2 className="h2 mb-2">A bit more practice</h2>
            <ul className="list-none p-0 m-0 flex flex-col gap-2">
              {s.needsPractice.map((n) => (
                <li key={n.wordId} className="flex items-center justify-between gap-2">
                  <span><span className="font-extrabold">{n.sv}</span> <span className="muted">→</span> <span lang="en" className="font-extrabold" style={{ color: 'var(--color-lav-d)' }}>{n.en}</span></span>
                  {speechSupported() && (
                    <button type="button" className="icon-btn" aria-label={`Listen to ${n.en}`} onClick={() => speak(n.en, { ...speech, enabled: true })} style={{ boxShadow: 'none' }}>
                      <SpeakerIcon width="22" height="22" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <button type="button" className="btn btn-primary btn-big w-full mt-3" onClick={onExit}>Done</button>
    </div>
  );
}
