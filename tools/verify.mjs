/* BEAM 検証スクリプト（開発用）
   実行: node tools/verify.mjs
   - iPhone相当 / PC相当 でホームとかざす画面を描画してスクリーンショット
   - QRを画像として切り出し、あとで zbarimg でデコード検証する
*/
import { chromium, devices } from '/tmp/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SHOTS = path.join(ROOT, 'tools', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('nf');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(4173, r));
const BASE = 'http://localhost:4173/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function run(label, ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${label}] pageerror: ${e.message}`));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, `${label}-home.png`), fullPage: true });

  const cards = await page.locator('.card').count();

  // 1件目をかざす画面で開く
  await page.locator('.card-main').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, `${label}-beam.png`) });
  await page.locator('#qr').screenshot({ path: path.join(SHOTS, `${label}-qr.png`) });

  const shown = {
    name: await page.locator('#beamerName').textContent(),
    url: await page.locator('#beamerUrl').textContent(),
    qrBox: await page.locator('#qr').boundingBox(),
  };

  await page.locator('#beamerClose').click();
  await page.waitForTimeout(200);

  // 追加シート
  await page.locator('#addBtn').click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(SHOTS, `${label}-sheet.png`) });

  // 追加動作の実テスト（https:// なしで入れて自動補完されるか）
  await page.fill('#fName', 'テスト用リンク');
  await page.fill('#fUrl', 'example.com/live?a=1');
  await page.fill('#fNote', '追加テスト');
  await page.locator('#saveBtn').click();
  await page.waitForTimeout(400);
  const cardsAfter = await page.locator('.card').count();
  const savedNote = await page.locator('.card').last().locator('.card-note').textContent();
  await page.screenshot({ path: path.join(SHOTS, `${label}-added.png`), fullPage: true });

  // 追加したものをかざしてQRを取り出す
  await page.locator('.card-main').last().click();
  await page.waitForTimeout(450);
  await page.locator('#qr').screenshot({ path: path.join(SHOTS, `${label}-qr-custom.png`) });
  await page.locator('#beamerClose').click();

  // 不正URLのバリデーション
  await page.waitForTimeout(200);
  await page.locator('.card').last().locator('.card-edit').click();
  await page.waitForTimeout(300);
  await page.fill('#fUrl', 'これはURLじゃない');
  await page.locator('#saveBtn').click();
  await page.waitForTimeout(250);
  const errVisible = await page.locator('#fError').isVisible();
  await page.screenshot({ path: path.join(SHOTS, `${label}-invalid.png`) });

  await ctx.close();
  return { label, cards, cardsAfter, savedNote, errVisible, ...shown };
}

const r1 = await run('iphone', { ...devices['iPhone 13'], hasTouch: true });
const r2 = await run('desktop', { viewport: { width: 1280, height: 900 } });
const r3 = await run('iphone-dark', { ...devices['iPhone 13'], colorScheme: 'dark' });

console.log(JSON.stringify({ r1, r2, r3, errors }, null, 2));

await browser.close();
server.close();
