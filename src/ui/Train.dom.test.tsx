// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/db';
import { createList, ensureInitialized, hatchEgg } from '../db/actions';
import { TrainScreen } from './TrainScreen';

async function reset() {
  await Promise.all(db.tables.map((t) => t.clear()));
  await ensureInitialized(db);
  await hatchEgg(db);
}

beforeEach(reset);
afterEach(cleanup);

const PAIRS = [
  { sv: 'hund', en: 'dog' }, { sv: 'katt', en: 'cat' }, { sv: 'fjäril', en: 'butterfly' },
  { sv: 'häst', en: 'horse' }, { sv: 'fågel', en: 'bird' }, { sv: 'blomma', en: 'flower' },
];

describe('TrainScreen', () => {
  it('shows an empty state when there are no words', async () => {
    render(<TrainScreen onExit={() => {}} onHatch={() => {}} onImport={() => {}} />);
    expect(await screen.findByText('Inga glosor än')).toBeInTheDocument();
  });

  it('asks a multiple-choice question, marks the right answer and gives a reward', async () => {
    await createList(db, { name: 'v1', weekNumber: 1 }, PAIRS);
    const user = userEvent.setup();
    render(<TrainScreen onExit={() => {}} onHatch={() => {}} onImport={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Starta' }));

    const sv = (await waitFor(() => { const el = document.querySelector('.q-word'); if (!el) throw new Error('no question yet'); return el; })).textContent!;
    const en = PAIRS.find((p) => p.sv === sv)!.en;
    const options = screen.getAllByRole('button').filter((b) => b.classList.contains('choice'));
    expect(options).toHaveLength(4);
    expect(options.filter((b) => b.textContent === en)).toHaveLength(1); // exactly one correct option

    await user.click(options.find((b) => b.textContent === en)!);
    expect(await screen.findByText('Rätt!')).toBeInTheDocument();
    await waitFor(async () => expect((await db.game.get('main'))!.totalXp).toBe(5));
    expect(screen.getByRole('button', { name: 'Nästa' })).toBeInTheDocument();
    options.forEach((b) => expect(b).toBeDisabled()); // no second answer possible
  });

  it('shows the correct translation after a wrong answer, with no XP lost', async () => {
    await createList(db, { name: 'v1', weekNumber: 1 }, PAIRS);
    const user = userEvent.setup();
    render(<TrainScreen onExit={() => {}} onHatch={() => {}} onImport={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Starta' }));
    const sv = (await waitFor(() => { const el = document.querySelector('.q-word'); if (!el) throw new Error('no question yet'); return el; })).textContent!;
    const en = PAIRS.find((p) => p.sv === sv)!.en;
    const wrong = screen.getAllByRole('button').filter((b) => b.classList.contains('choice') && b.textContent !== en)[0]!;
    await user.click(wrong);
    expect(await screen.findByText(/Rätt svar:/)).toHaveTextContent(en);
    expect((await db.game.get('main'))!.totalXp).toBe(0);
  });
});
