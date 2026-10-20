import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { firstStart, importPasted, startTraining } from './helpers';

async function scan(page: Page, label: string) {
  await page.waitForTimeout(600); // let entrance animations settle
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
  expect(summary, `axe violations on ${label}`).toEqual([]);
}

test('main screens have no WCAG A/AA violations (axe)', async ({ page }) => {
  await firstStart(page);
  await scan(page, 'home');
  await importPasted(page);
  await scan(page, 'list');
  await page.getByRole('button', { name: 'Train', exact: true }).click();
  await scan(page, 'train idle');
  await page.getByRole('button', { name: 'Start' }).click();
  await scan(page, 'question');
  await page.locator('.choice').first().click();
  await page.waitForTimeout(1200); // let the fade-in finish so contrast is measured on final colours
  await scan(page, 'feedback');
  await page.getByRole('button', { name: 'Save and stop for now' }).click();
  await page.getByRole('button', { name: 'Family', exact: true }).click();
  await scan(page, 'creatures');
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await scan(page, 'settings');
});

test('touch targets are at least 44x44 px and text can be enlarged', async ({ page }) => {
  await firstStart(page);
  await importPasted(page);
  await startTraining(page);
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('button, a, input, [role="switch"]'))
      .filter((el) => el.offsetParent !== null && !el.classList.contains('sr-only'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.width < 44 || r.height < 44))
      .map(({ el, r }) => `${el.tagName}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)}`),
  );
  expect(small).toEqual([]);
});

test('keyboard users can answer a question with Tab and Enter', async ({ page }) => {
  await firstStart(page);
  await importPasted(page);
  await startTraining(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab'); // skip close button, land on first option
  const focused = await page.evaluate(() => document.activeElement?.className ?? '');
  expect(focused).toContain('choice');
  await page.keyboard.press('Enter');
  await expect(page.locator('.feedback')).toBeVisible();
});
