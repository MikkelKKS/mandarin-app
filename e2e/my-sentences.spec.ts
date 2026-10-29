import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
const DICT = [
  ['我', 'wǒ', 'wo', 'I / me', '1'],
  ['想', 'xiǎng', 'xiang', 'to want', '1'],
  ['去', 'qù', 'qu', 'to go', '1'],
  ['北京', 'Běi jīng', 'beijing', 'Beijing', '1'],
]
  .map((r) => r.join('\t'))
  .join('\n');

test('save a sentence in the dictionary: it comes into the next session', async ({ page }) => {
  await page.route('**/audio/**', (r) => r.abort());
  await page.route('**/dict/cedict.tsv', (r) => r.fulfill({ body: DICT, contentType: 'text/plain' }));
  await page.route('https://api.mymemory.translated.net/**', (r) => r.fulfill({ json: { responseStatus: 200, responseData: { translatedText: 'I want to go to Beijing.' }, matches: [] } }));
  await page.goto(`./#/dictionary?q=${encodeURIComponent('我想去北京。')}`);
  await page.getByRole('button', { name: '+ Save this sentence for practice' }).click();
  await expect(page.getByLabel('English')).toHaveValue('I want to go to Beijing.');
  await expect(page.getByLabel('Pinyin')).not.toHaveValue('');
  await page.getByRole('button', { name: 'Save sentence' }).click();
  await expect(page.getByText(/In your sentences/)).toBeVisible();
  // Listed on the dictionary's start page.
  await page.getByRole('textbox', { name: 'Search the dictionary' }).fill('');
  await expect(page.getByText('Your sentences (1)')).toBeVisible();

  await page.goto('./#/session/quick/x');
  await expect(page.getByText('Your sentences', { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('I want to go to Beijing.')).toBeVisible();
  await page.getByRole('textbox').fill('wo3 xiang3 qu4 bei3jing1');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('Right', { exact: true })).toBeVisible();
});
