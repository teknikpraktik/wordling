import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  LIST_TEXT, answer, firstStart, importPasted, nextQuestion, patchGame, readTable, runSession, startTraining,
} from './helpers';

type Game = { totalXp: number; food: number; eggsHatched: number; activeCreatureId: string };
type Creature = { id: string; species: string; xp: number; stage: number };

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  (page as unknown as { __errors: string[] }).__errors = errors;
});
test.afterEach(async ({ page }) => {
  expect((page as unknown as { __errors: string[] }).__errors).toEqual([]);
});

test('first start: egg hatches into a stored creature', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Wordling!' })).toBeVisible();
  await page.getByRole('button', { name: 'Hatch the egg' }).click();
  // the result is stored before the reveal animation finishes
  await expect.poll(async () => (await readTable(page, 'OwnedCreatures')).length).toBe(1);
  await page.getByRole('button', { name: /^Hello,/ }).click();
  await expect(page.getByRole('button', { name: /^TRAIN/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /^TRAIN/ })).toBeVisible();
  expect(await readTable(page, 'OwnedCreatures')).toHaveLength(1);
});

test('import ten words, train, wrong answers get a second chance without penalty', async ({ page }) => {
  await firstStart(page);
  await importPasted(page);
  expect(await readTable(page, 'Words')).toHaveLength(10);

  await startTraining(page);
  const first = await answer(page, true);
  await expect(page.locator('.feedback')).toContainText(`Correct answer: ${first.en}`);
  await expect(page.locator('.feedback')).toContainText('again soon');
  expect((await readTable<Game>(page, 'GameState'))[0]!.totalXp).toBe(0); // no negative or positive effect
  await nextQuestion(page);
  while (!(await page.getByRole('heading', { name: 'Well done!' }).isVisible())) {
    await answer(page);
    await nextQuestion(page);
  }
  await expect(page.getByText(/\d+ of \d+ correct/)).toBeVisible();
  await expect(page.getByText('A bit more practice')).toBeVisible();
  const game = (await readTable<Game>(page, 'GameState'))[0]!;
  expect(game.totalXp).toBeGreaterThan(0);
  const creature = (await readTable<Creature>(page, 'OwnedCreatures'))[0]!;
  expect(creature.xp).toBe(game.totalXp);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /^(TRAIN|CONTINUE)/ })).toBeVisible();
});

test('the reward system cannot be farmed by double taps or reloads', async ({ page }) => {
  await firstStart(page);
  await importPasted(page);
  await startTraining(page);
  const sv = (await page.locator('.q-word').innerText()).trim();
  const right = page.locator('.choice', { hasText: new RegExp(`^\\s*${({ hund: 'dog', katt: 'cat', fjäril: 'butterfly', häst: 'horse', fågel: 'bird', blomma: 'flower', träd: 'tree', hus: 'house', bil: 'car', bok: 'book' } as Record<string, string>)[sv]}\\s*$`) });
  await right.dblclick();
  await right.click({ force: true, timeout: 1000 }).catch(() => undefined);
  await expect(page.locator('.feedback')).toContainText('Correct!');
  const before = (await readTable<Game>(page, 'GameState'))[0]!;
  expect(before.totalXp).toBe(5);
  for (let i = 0; i < 3; i++) {
    await page.reload();
    await page.getByRole('button', { name: /^CONTINUE/ }).click(); // the unfinished session is resumed
    await expect(page.locator('.feedback')).toContainText('Correct!'); // same question, same feedback
  }
  const after = (await readTable<Game>(page, 'GameState'))[0]!;
  expect(after.totalXp).toBe(5);
  expect(await readTable(page, 'RewardEvents')).toHaveLength(1);
  expect(await readTable(page, 'ReviewEvents')).toHaveLength(1);
});

test('come back after several simulated days: reviews return, intervals grow', async ({ page }) => {
  const day = (d: number) => new Date(2026, 5, d, 15, 0, 0);
  await page.clock.setFixedTime(day(1));
  await firstStart(page);
  await importPasted(page);

  await startTraining(page);
  await runSession(page);
  await page.getByRole('button', { name: 'Done' }).click();
  await startTraining(page);
  await runSession(page);
  await page.getByRole('button', { name: 'Done' }).click();

  // nothing is due the same afternoon
  await page.getByRole('button', { name: 'Train', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'All done for today!' })).toBeVisible();

  const states = async () => Object.fromEntries((await readTable<{ state: string }>(page, 'WordProgress')).map((p, i) => [i, p.state]));
  expect(Object.values(await states()).filter((s) => s === 'REVIEW').length).toBeGreaterThanOrEqual(5);

  for (const d of [2, 5]) {
    await page.clock.setFixedTime(day(d));
    await page.reload();
    await page.getByRole('button', { name: 'Home' }).click();
    await expect(page.getByText(/words? ready/)).toBeVisible();
    await startTraining(page);
    await expect(page.getByLabel('Your answer in English')).toBeVisible(); // reviews are typed, never multiple-choice
    await runSession(page);
    await page.getByRole('button', { name: 'Done' }).click();
  }
  const progress = await readTable<{ state: string; intervalDays: number }>(page, 'WordProgress');
  expect(Math.max(...progress.map((p) => p.intervalDays))).toBeGreaterThanOrEqual(7);

  // setting the clock back does not reveal anything new
  await page.clock.setFixedTime(day(1));
  await page.reload();
  await page.getByRole('button', { name: 'Train', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'All done for today!' })).toBeVisible();
});

test('egg unlocks with XP, hatches a new species, and the active creature can be switched', async ({ page }) => {
  await firstStart(page);
  const first = (await readTable<Creature>(page, 'OwnedCreatures'))[0]!;
  await patchGame(page, { totalXp: 260 });
  await page.reload();
  await page.getByRole('button', { name: /New egg! Hatch it/ }).click();
  await page.getByRole('button', { name: 'Hatch the egg' }).click();
  await page.getByRole('button', { name: /^Hello,/ }).click();
  const creatures = await readTable<Creature>(page, 'OwnedCreatures');
  expect(creatures).toHaveLength(2);
  expect(new Set(creatures.map((c) => c.species)).size).toBe(2);
  const second = creatures.find((c) => c.id !== first.id)!;

  await page.getByRole('button', { name: 'Family', exact: true }).click();
  await expect(page.getByText('2 of 6 found')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`^${second.species[0]!.toUpperCase()}${second.species.slice(1)},`) }).click();
  await page.getByRole('button', { name: /^Choose / }).click();
  await expect.poll(async () => (await readTable<Game>(page, 'GameState'))[0]!.activeCreatureId).toBe(second.id);
});

test('pet, feed, play and sleep respond; feeding costs food and makes the creature grow', async ({ page }) => {
  await firstStart(page);
  await patchGame(page, { food: 3 });
  await page.reload();
  const creature = (await readTable<Creature>(page, 'OwnedCreatures'))[0]!;
  await page.locator('.pet-btn').click();
  await expect(page.locator('.creature.mood-pet')).toBeVisible();
  await page.getByRole('button', { name: 'Feed' }).click();
  await expect(page.locator('.creature.mood-eat')).toBeVisible();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('.creature.mood-play')).toBeVisible();
  await page.getByRole('button', { name: 'Sleep' }).click();
  await expect(page.locator('.creature.mood-sleep')).toBeVisible();
  const game = (await readTable<Game>(page, 'GameState'))[0]!;
  expect(game.food).toBe(2);
  expect(game.totalXp).toBe(0); // eggs still depend on practice only
  expect((await readTable<Creature>(page, 'OwnedCreatures'))[0]!.xp).toBe(creature.xp + 4);
});

test('works offline after the first load', async ({ page, context }) => {
  await firstStart(page);
  await importPasted(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // now controlled by the service worker
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: /^(TRAIN|CONTINUE)/ })).toBeVisible();
  await startTraining(page);
  await answer(page);
  await nextQuestion(page);
  await page.getByRole('button', { name: 'Save and stop for now' }).click();
  await page.getByRole('button', { name: 'Words', exact: true }).click();
  await expect(page.getByText('Week')).toBeVisible();
  await context.setOffline(false);
});

test('backup and restore round-trip, and an invalid file changes nothing', async ({ page }) => {
  await firstStart(page);
  await importPasted(page);
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Save backup/ }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const backup = readFileSync(path!, 'utf8');
  expect(JSON.parse(backup).format).toBe('wordling-backup');
  await page.getByRole('button', { name: 'Done' }).click();

  // change state: delete the list
  await page.getByRole('button', { name: 'Words', exact: true }).click();
  await page.getByRole('button', { name: /^Week \d+, 10 words/ }).click();
  await page.getByRole('button', { name: 'Delete the list' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  expect(await readTable(page, 'Words')).toHaveLength(0);

  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  // invalid file: refused with a message, data untouched
  await page.getByLabel('Choose backup file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":true}') });
  await expect(page.getByRole('status').filter({ hasText: 'not a Wordling backup' })).toBeVisible();
  expect(await readTable(page, 'VocabularyLists')).toHaveLength(0);
  // valid file: confirmation first
  await page.getByLabel('Choose backup file').setInputFiles({ name: 'ok.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await expect(page.getByRole('alertdialog')).toContainText('10 words');
  await page.getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByText('Everything has been restored.')).toBeVisible();
  expect(await readTable(page, 'Words')).toHaveLength(10);
});

test('camera import reads a printed two-column list on-device (OCR)', async ({ page }) => {
  test.setTimeout(180_000);
  await firstStart(page);
  await page.getByRole('button', { name: 'Words', exact: true }).click();
  await page.getByRole('button', { name: 'Add words' }).click();
  await page.getByTestId('photo-file').setInputFiles('e2e/fixtures/wordlist.png');
  await expect(page.getByRole('heading', { name: 'Reading the list…' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Words to review' })).toBeVisible({ timeout: 150_000 });
  const values = await page.locator('table.words input').evaluateAll((els) => (els as HTMLInputElement[]).map((e) => e.value.toLowerCase()));
  for (const w of ['hund', 'dog', 'katt', 'cat', 'fjäril', 'butterfly', 'häst', 'horse', 'blomma', 'flower', 'hus', 'house']) {
    expect(values, `OCR should have read "${w}"`).toContain(w);
  }
  // English is read from the first column and Swedish from the second; capitals are shown in lower case
  const pairs = await page.locator('table.words tr').evaluateAll((trs) =>
    trs.map((tr) => Array.from(tr.querySelectorAll('input')).map((i) => (i as HTMLInputElement).value)),
  );
  expect(pairs).toContainEqual(['fjäril', 'butterfly']);
  expect(pairs).toContainEqual(['hund', 'dog']);
  expect(pairs).toContainEqual(['katt', 'cat']);
  // the title line cannot be paired, so it is flagged instead of guessed
  await expect(page.getByText('Could not tell which words belong together')).toBeVisible();
  await expect(page.getByText(/to be completed or removed/)).toBeVisible();
  // the user removes the flagged row, then saves
  const flagged = page.locator('tr.row-warn');
  await flagged.first().getByRole('button', { name: /Remove row/ }).click();
  await page.getByRole('button', { name: /^Save \d+ words$/ }).click();
  await expect(page.getByRole('button', { name: 'More words' })).toBeVisible();
  expect((await readTable(page, 'Words')).length).toBeGreaterThanOrEqual(8);
});

test('paste import: duplicates and unclear lines are flagged, editing works', async ({ page }) => {
  await firstStart(page);
  await page.getByRole('button', { name: 'Words', exact: true }).click();
  await page.getByRole('button', { name: 'Add words' }).click();
  await page.getByLabel(/One word pair per line/).fill(`${LIST_TEXT}\nhund;dog\nVecka 5`);
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText('Already exists.')).toBeVisible();
  await expect(page.getByText(/No separator found/)).toBeVisible();
  await page.getByRole('button', { name: /Remove row 12/ }).click();
  await page.getByRole('textbox', { name: 'English, row 1', exact: true }).fill('doggy');
  await page.getByRole('button', { name: /Save 10 words/ }).click();
  await page.getByRole('button', { name: /hund → doggy|Edit hund/ }).first().click();
  await expect(page.getByLabel('English (several correct answers: separate with /)')).toHaveValue('doggy');
});

test('OCR keeps working offline once the language models are cached', async ({ page, context }) => {
  test.setTimeout(240_000);
  await firstStart(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  const readPhoto = async () => {
    await page.getByRole('button', { name: 'Words', exact: true }).click();
    await page.getByRole('button', { name: 'Add words' }).click();
    await page.getByTestId('photo-file').setInputFiles('e2e/fixtures/wordlist.png');
    await expect(page.getByRole('table', { name: 'Words to review' })).toBeVisible({ timeout: 150_000 });
    const values = await page.locator('table.words input').evaluateAll((els) => (els as HTMLInputElement[]).map((e) => e.value.toLowerCase()));
    expect(values).toContain('butterfly');
    expect(values).toContain('fjäril');
  };

  await readPhoto(); // online: engine + models get cached
  await context.setOffline(true);
  await page.reload();
  await readPhoto(); // offline
  await context.setOffline(false);
});

test('the growth track shows where the creature is and how big it can become', async ({ page }) => {
  await firstStart(page);
  const track = page.getByRole('progressbar', { name: /has grown/ });
  await expect(track).toBeVisible();
  await expect(track).toHaveAttribute('aria-valuetext', /0 of 500 XP\. Now: Baby/);
  await expect(page.getByText(/150 XP|to go until Growing/).first()).toBeVisible();
  const creature = (await readTable<Creature>(page, 'OwnedCreatures'))[0]!;
  await page.evaluate(
    (id) =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open('wordling');
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('OwnedCreatures', 'readwrite');
          const st = tx.objectStore('OwnedCreatures');
          const get = st.get(id);
          get.onsuccess = () => st.put({ ...get.result, xp: 200, stage: 2 });
          tx.oncomplete = () => { db.close(); resolve(); };
        };
      }),
    creature.id,
  );
  await page.reload();
  await expect(page.getByRole('progressbar', { name: /has grown/ })).toHaveAttribute('aria-valuetext', /200 of 500 XP\. Now: Growing/);
  await expect(page.getByText('300 to go until Grown-up')).toBeVisible();
});

test('food can be fed in rapid succession, every tap counts and animations overlap', async ({ page }) => {
  await firstStart(page);
  await patchGame(page, { food: 12 });
  await page.reload();
  const feed = page.getByRole('button', { name: 'Feed' });
  for (let i = 0; i < 6; i++) await feed.click({ delay: 0, noWaitAfter: true });
  await expect.poll(async () => (await readTable<Game>(page, 'GameState'))[0]!.food).toBe(6);
  expect((await readTable<Creature>(page, 'OwnedCreatures'))[0]!.xp).toBe(24);
  await expect(page.locator('.creature.mood-eat')).toBeVisible();
  // never more feedings than food: drain the rest and keep tapping
  for (let i = 0; i < 9; i++) await feed.click({ delay: 0, noWaitAfter: true, force: true, timeout: 500 }).catch(() => undefined);
  await expect.poll(async () => (await readTable<Game>(page, 'GameState'))[0]!.food).toBe(0);
  expect((await readTable<Creature>(page, 'OwnedCreatures'))[0]!.xp).toBe(48);
});

test('a parent can add an example sentence to a word', async ({ page }) => {
  await firstStart(page);
  await importPasted(page);
  await page.getByRole('button', { name: /Edit hund/ }).click();
  await page.getByLabel(/Example sentence/).fill('The dog is very happy.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const words = await readTable<{ sv: string; example?: string }>(page, 'Words');
  expect(words.find((w) => w.sv === 'hund')!.example).toBe('The dog is very happy.');
});
