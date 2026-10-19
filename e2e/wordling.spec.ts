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
  await expect(page.getByRole('heading', { name: 'Välkommen till Wordling!' })).toBeVisible();
  await page.getByRole('button', { name: 'Kläck ägget' }).click();
  // the result is stored before the reveal animation finishes
  await expect.poll(async () => (await readTable(page, 'OwnedCreatures')).length).toBe(1);
  await page.getByRole('button', { name: /^Hej,/ }).click();
  await expect(page.getByRole('button', { name: 'TRÄNA', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'TRÄNA', exact: true })).toBeVisible();
  expect(await readTable(page, 'OwnedCreatures')).toHaveLength(1);
});

test('import ten words, train, wrong answers get a second chance without penalty', async ({ page }) => {
  await firstStart(page);
  await importPasted(page);
  expect(await readTable(page, 'Words')).toHaveLength(10);

  await startTraining(page);
  const first = await answer(page, true);
  await expect(page.locator('.feedback')).toContainText(`Rätt svar: ${first.en}`);
  await expect(page.locator('.feedback')).toContainText('igen strax');
  expect((await readTable<Game>(page, 'GameState'))[0]!.totalXp).toBe(0); // no negative or positive effect
  await nextQuestion(page);
  while (!(await page.getByRole('heading', { name: 'Bra jobbat!' }).isVisible())) {
    await answer(page);
    await nextQuestion(page);
  }
  await expect(page.getByText(/\d+ av \d+ rätt/)).toBeVisible();
  await expect(page.getByText('Tränar vi lite mer')).toBeVisible();
  const game = (await readTable<Game>(page, 'GameState'))[0]!;
  expect(game.totalXp).toBeGreaterThan(0);
  const creature = (await readTable<Creature>(page, 'OwnedCreatures'))[0]!;
  expect(creature.xp).toBe(game.totalXp);
  await page.getByRole('button', { name: 'Klar' }).click();
  await expect(page.getByRole('button', { name: /^(TRÄNA|FORTSÄTT)$/ })).toBeVisible();
});

test('the reward system cannot be farmed by double taps or reloads', async ({ page }) => {
  await firstStart(page);
  await importPasted(page);
  await startTraining(page);
  const sv = (await page.locator('.q-word').innerText()).trim();
  const right = page.locator('.choice', { hasText: new RegExp(`^\\s*${({ hund: 'dog', katt: 'cat', fjäril: 'butterfly', häst: 'horse', fågel: 'bird', blomma: 'flower', träd: 'tree', hus: 'house', bil: 'car', bok: 'book' } as Record<string, string>)[sv]}\\s*$`) });
  await right.dblclick();
  await right.click({ force: true, timeout: 1000 }).catch(() => undefined);
  await expect(page.locator('.feedback')).toContainText('Rätt!');
  const before = (await readTable<Game>(page, 'GameState'))[0]!;
  expect(before.totalXp).toBe(5);
  for (let i = 0; i < 3; i++) {
    await page.reload();
    await page.getByRole('button', { name: 'FORTSÄTT', exact: true }).click(); // the unfinished session is resumed
    await expect(page.locator('.feedback')).toContainText('Rätt!'); // same question, same feedback
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
  await page.getByRole('button', { name: 'Klar' }).click();
  await startTraining(page);
  await runSession(page);
  await page.getByRole('button', { name: 'Klar' }).click();

  // nothing is due the same afternoon
  await page.getByRole('button', { name: 'Träna', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Allt klart för idag!' })).toBeVisible();

  const states = async () => Object.fromEntries((await readTable<{ state: string }>(page, 'WordProgress')).map((p, i) => [i, p.state]));
  expect(Object.values(await states()).filter((s) => s === 'REVIEW').length).toBeGreaterThanOrEqual(5);

  for (const d of [2, 5]) {
    await page.clock.setFixedTime(day(d));
    await page.reload();
    await page.getByRole('button', { name: 'Hem' }).click();
    await expect(page.getByText(/glosor? redo/)).toBeVisible();
    await startTraining(page);
    await expect(page.getByLabel('Ditt svar på engelska')).toBeVisible(); // reviews are typed, never multiple-choice
    await runSession(page);
    await page.getByRole('button', { name: 'Klar' }).click();
  }
  const progress = await readTable<{ state: string; intervalDays: number }>(page, 'WordProgress');
  expect(Math.max(...progress.map((p) => p.intervalDays))).toBeGreaterThanOrEqual(7);

  // setting the clock back does not reveal anything new
  await page.clock.setFixedTime(day(1));
  await page.reload();
  await page.getByRole('button', { name: 'Träna', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Allt klart för idag!' })).toBeVisible();
});

test('egg unlocks with XP, hatches a new species, and the active creature can be switched', async ({ page }) => {
  await firstStart(page);
  const first = (await readTable<Creature>(page, 'OwnedCreatures'))[0]!;
  await patchGame(page, { totalXp: 260 });
  await page.reload();
  await page.getByRole('button', { name: /Nytt ägg! Kläck det/ }).click();
  await page.getByRole('button', { name: 'Kläck ägget' }).click();
  await page.getByRole('button', { name: /^Hej,/ }).click();
  const creatures = await readTable<Creature>(page, 'OwnedCreatures');
  expect(creatures).toHaveLength(2);
  expect(new Set(creatures.map((c) => c.species)).size).toBe(2);
  const second = creatures.find((c) => c.id !== first.id)!;

  await page.getByRole('button', { name: 'Figurer', exact: true }).click();
  await expect(page.getByText('2 av 6 hittade')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`^${second.species[0]!.toUpperCase()}${second.species.slice(1)},`) }).click();
  await page.getByRole('button', { name: /^Välj / }).click();
  await expect.poll(async () => (await readTable<Game>(page, 'GameState'))[0]!.activeCreatureId).toBe(second.id);
});

test('pet, feed, play and sleep respond; feeding costs food and makes the creature grow', async ({ page }) => {
  await firstStart(page);
  await patchGame(page, { food: 3 });
  await page.reload();
  const creature = (await readTable<Creature>(page, 'OwnedCreatures'))[0]!;
  await page.locator('.pet-btn').click();
  await expect(page.locator('.creature.mood-pet')).toBeVisible();
  await page.getByRole('button', { name: 'Mata' }).click();
  await expect(page.locator('.creature.mood-eat')).toBeVisible();
  await page.getByRole('button', { name: 'Leka' }).click();
  await expect(page.locator('.creature.mood-play')).toBeVisible();
  await page.getByRole('button', { name: 'Sov' }).click();
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
  await expect(page.getByRole('button', { name: /^(TRÄNA|FORTSÄTT)$/ })).toBeVisible();
  await startTraining(page);
  await answer(page);
  await nextQuestion(page);
  await page.getByRole('button', { name: 'Spara och sluta för nu' }).click();
  await page.getByRole('button', { name: 'Glosor', exact: true }).click();
  await expect(page.getByText('Vecka')).toBeVisible();
  await context.setOffline(false);
});

test('backup and restore round-trip, and an invalid file changes nothing', async ({ page }) => {
  await firstStart(page);
  await importPasted(page);
  await page.getByRole('button', { name: 'Hem' }).click();
  await page.getByRole('button', { name: 'Inställningar' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Spara kopia/ }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const backup = readFileSync(path!, 'utf8');
  expect(JSON.parse(backup).format).toBe('wordling-backup');
  await page.getByRole('button', { name: 'Klar' }).click();

  // change state: delete the list
  await page.getByRole('button', { name: 'Glosor', exact: true }).click();
  await page.getByRole('button', { name: /^Vecka \d+, 10 glosor/ }).click();
  await page.getByRole('button', { name: 'Ta bort listan' }).click();
  await page.getByRole('button', { name: 'Ta bort', exact: true }).click();
  expect(await readTable(page, 'Words')).toHaveLength(0);

  await page.getByRole('button', { name: 'Hem' }).click();
  await page.getByRole('button', { name: 'Inställningar' }).click();
  // invalid file: refused with a message, data untouched
  await page.getByLabel('Välj backupfil').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":true}') });
  await expect(page.getByRole('status').filter({ hasText: 'inte en Wordling-backup' })).toBeVisible();
  expect(await readTable(page, 'VocabularyLists')).toHaveLength(0);
  // valid file: confirmation first
  await page.getByLabel('Välj backupfil').setInputFiles({ name: 'ok.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await expect(page.getByRole('alertdialog')).toContainText('10 glosor');
  await page.getByRole('button', { name: 'Ersätt' }).click();
  await expect(page.getByText('Allt är återställt.')).toBeVisible();
  expect(await readTable(page, 'Words')).toHaveLength(10);
});

test('camera import reads a printed two-column list on-device (OCR)', async ({ page }) => {
  test.setTimeout(180_000);
  await firstStart(page);
  await page.getByRole('button', { name: 'Glosor', exact: true }).click();
  await page.getByRole('button', { name: 'Lägg in glosor' }).click();
  await page.getByTestId('photo-file').setInputFiles('e2e/fixtures/wordlist.png');
  await expect(page.getByRole('heading', { name: 'Läser listan…' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Glosor att granska' })).toBeVisible({ timeout: 150_000 });
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
  await expect(page.getByText('Kunde inte avgöra vilket ord som hör ihop')).toBeVisible();
  await expect(page.getByText(/rad behöver kompletteras/)).toBeVisible();
  // the user removes the flagged row, then saves
  const flagged = page.locator('tr.row-warn');
  await flagged.first().getByRole('button', { name: /Ta bort rad/ }).click();
  await page.getByRole('button', { name: /^Spara \d+ glosor$/ }).click();
  await expect(page.getByRole('button', { name: 'Fler glosor' })).toBeVisible();
  expect((await readTable(page, 'Words')).length).toBeGreaterThanOrEqual(8);
});

test('paste import: duplicates and unclear lines are flagged, editing works', async ({ page }) => {
  await firstStart(page);
  await page.getByRole('button', { name: 'Glosor', exact: true }).click();
  await page.getByRole('button', { name: 'Lägg in glosor' }).click();
  await page.getByLabel(/Ett ordpar per rad/).fill(`${LIST_TEXT}\nhund;dog\nVecka 5`);
  await page.getByRole('button', { name: 'Granska' }).click();
  await expect(page.getByText('Finns redan.')).toBeVisible();
  await expect(page.getByText(/Hittade ingen avskiljare/)).toBeVisible();
  await page.getByRole('button', { name: /Ta bort rad 12/ }).click();
  await page.getByRole('textbox', { name: 'Engelska, rad 1', exact: true }).fill('doggy');
  await page.getByRole('button', { name: /Spara 10 glosor/ }).click();
  await page.getByRole('button', { name: /hund → doggy|Redigera hund/ }).first().click();
  await expect(page.getByLabel('Engelska (flera rätta svar: skilj med /)')).toHaveValue('doggy');
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
    await page.getByRole('button', { name: 'Glosor', exact: true }).click();
    await page.getByRole('button', { name: 'Lägg in glosor' }).click();
    await page.getByTestId('photo-file').setInputFiles('e2e/fixtures/wordlist.png');
    await expect(page.getByRole('table', { name: 'Glosor att granska' })).toBeVisible({ timeout: 150_000 });
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
