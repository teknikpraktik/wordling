import { expect, type Page } from '@playwright/test';

export const PAIRS: Record<string, string> = {
  hund: 'dog', katt: 'cat', fjäril: 'butterfly', häst: 'horse', fågel: 'bird',
  blomma: 'flower', träd: 'tree', hus: 'house', bil: 'car', bok: 'book',
};
export const LIST_TEXT = Object.entries(PAIRS).map(([sv, en]) => `${sv} - ${en}`).join('\n');

export async function firstStart(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Kläck ägget' }).click();
  await page.getByRole('button', { name: /^Hej,/ }).click();
  await expect(page.getByRole('button', { name: /^TRÄNA/ })).toBeVisible();
}

export async function importPasted(page: Page, text = LIST_TEXT, count = Object.keys(PAIRS).length) {
  await page.getByRole('button', { name: 'Glosor', exact: true }).click();
  await page.getByRole('button', { name: 'Lägg in glosor' }).click();
  await page.getByLabel(/Ett ordpar per rad/).fill(text);
  await page.getByRole('button', { name: 'Granska' }).click();
  await page.getByRole('button', { name: new RegExp(`Spara ${count} glosor`) }).click();
  await expect(page.getByRole('button', { name: 'Fler glosor' })).toBeVisible();
}

export async function startTraining(page: Page) {
  await page.getByRole('button', { name: 'Träna', exact: true }).click();
  await page.getByRole('button', { name: 'Starta' }).click();
  await expect(page.locator('.q-word')).toBeVisible();
}

/** Answers the current question. `wrong` picks a wrong option / types nonsense. */
export async function answer(page: Page, wrong = false) {
  const sv = (await page.locator('.q-word').innerText()).trim();
  const en = PAIRS[sv]!;
  if (await page.locator('.choice').count()) {
    if (wrong) {
      const options = await page.locator('.choice').allInnerTexts();
      const bad = options.map((o) => o.trim()).find((o) => o !== en)!;
      await page.locator('.choice', { hasText: new RegExp(`^\\s*${bad}\\s*$`) }).click();
    } else {
      await page.locator('.choice', { hasText: new RegExp(`^\\s*${en}\\s*$`) }).click();
    }
  } else {
    await page.getByLabel('Ditt svar på engelska').fill(wrong ? 'zzzzzz' : en);
    await page.getByRole('button', { name: 'Svara' }).click();
  }
  await expect(page.locator('.feedback')).toBeVisible();
  return { sv, en };
}

export async function nextQuestion(page: Page) {
  await page.getByRole('button', { name: /^(Nästa|Klar)$/ }).click();
  // wait for the next question (or the summary) to replace the feedback
  await expect(page.locator('.feedback[role="status"]')).toHaveCount(0);
}

/** Plays through one whole session. `wrongFirst` makes the first answer wrong. */
export async function runSession(page: Page, opts: { wrongFirst?: boolean } = {}) {
  let n = 0;
  for (let guard = 0; guard < 40; guard++) {
    await expect(page.locator('.q-word')).toBeVisible();
    await answer(page, !!opts.wrongFirst && n === 0);
    n++;
    await nextQuestion(page);
    // the previous answer must never linger in the input field
    const input = page.getByLabel('Ditt svar på engelska');
    if (await input.count()) await expect(input).toHaveValue('');
    if (await page.getByRole('heading', { name: 'Bra jobbat!' }).isVisible()) break;
  }
  await expect(page.getByRole('heading', { name: 'Bra jobbat!' })).toBeVisible();
  return n;
}

/** Reads a table straight from IndexedDB. */
export async function readTable<T = Record<string, unknown>>(page: Page, table: string): Promise<T[]> {
  return page.evaluate(
    (t) =>
      new Promise<T[]>((resolve, reject) => {
        const open = indexedDB.open('wordling');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction(t, 'readonly').objectStore(t).getAll();
          req.onsuccess = () => {
            db.close();
            resolve(req.result as T[]);
          };
          req.onerror = () => reject(req.error);
        };
      }),
    table,
  );
}

export async function patchGame(page: Page, patch: Record<string, unknown>) {
  await page.evaluate(
    (p) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('wordling');
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('GameState', 'readwrite');
          const store = tx.objectStore('GameState');
          const get = store.get('main');
          get.onsuccess = () => store.put({ ...get.result, ...p });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    patch,
  );
}
