import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.env.LEVERIE_VIDEO_BASE_URL ?? 'http://127.0.0.1:5173';
const lang = process.env.LEVERIE_VIDEO_LANG === 'en' ? 'en' : 'ja';
const outputPath = resolve(
  process.env.LEVERIE_VIDEO_OUTPUT ??
    `artifacts/leverie-intro-30s-${lang}.webm`,
);
const videoDir = resolve(`artifacts/.video-recording-${lang}`);

const copy = {
  ja: {
    lang: 'ja',
    selectors: {
      guideClose: 'ガイドを閉じる',
      sampleButton: 'サンプルから始める',
      sampleHeading: '返金可否判定',
      createFromSample: 'サンプルから新規作成',
      evalPanel: '評価パネル',
      runEval: /評価実行/,
      result: '✓ 評価結果',
      flowchart: 'フローチャート',
    },
    values: {
      category: '電化製品',
      tier: '通常',
    },
    captions: {
      intro: [
        '30秒で見る LEVERIE',
        '条件・ルール・判定結果を、コードではなく表として編集できます。',
      ],
      sample: [
        'まずはサンプルから開始',
        '業務でよくある判定ロジックを読み込み、完成形をすぐ確認できます。',
      ],
      refund: [
        '返金ルールの例を選択',
        'カテゴリ、経過日数、顧客ティア、注文金額、破損有無で判定します。',
      ],
      table: [
        'ルールはそのまま表で見渡せる',
        '1行が1つの判定ルール。優先順、条件、結論を同じ画面で確認できます。',
      ],
      test: [
        '入力値を入れて、その場でテスト',
        '想定ケースを入力すると、どの行にマッチしたかまで追跡できます。',
      ],
      result: [
        '結果と実行トレースを確認',
        '一致したルールと、スキップされた理由が見えるので、レビューしやすくなります。',
      ],
      flowchart: [
        'フローチャートでも確認',
        '表で編集し、流れで説明できます。PCの広い画面で扱う価値が伝わります。',
      ],
      close: [
        'PCで本格的に編集できます',
        'モバイルでは概要を見せ、PCへ送る導線の動画として利用できます。',
      ],
    },
  },
  en: {
    lang: 'en',
    selectors: {
      guideClose: 'Close guide',
      sampleButton: 'Start from a sample',
      sampleHeading: 'Refund eligibility',
      createFromSample: 'Create new from sample',
      evalPanel: 'Evaluation Panel',
      runEval: /Evaluate/,
      result: '✓ Result',
      flowchart: 'Flowchart',
    },
    values: {
      category: 'Electronics',
      tier: 'Standard',
    },
    captions: {
      intro: [
        'LEVERIE in 30 seconds',
        'Edit conditions, rules, and outcomes as a table instead of code.',
      ],
      sample: [
        'Start with a sample',
        'Load a ready-made decision logic and see a complete working example.',
      ],
      refund: [
        'Choose a refund policy example',
        'Decide from category, days since order, customer tier, amount, and damage.',
      ],
      table: [
        'Rules stay visible in one table',
        'Each row is one decision rule, with priority, conditions, and results together.',
      ],
      test: [
        'Enter a case and test it',
        'Try realistic inputs and trace exactly which rule matched.',
      ],
      result: [
        'Review the result and trace',
        'Matched and skipped rules are visible, which makes policy review easier.',
      ],
      flowchart: [
        'Switch to a flowchart',
        'Edit in tables, then explain the decision path visually on a large screen.',
      ],
      close: [
        'Best for serious editing on desktop',
        'On mobile, this video can preview the value and guide users back to a PC.',
      ],
    },
  },
}[lang];

const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

async function moveMouseTo(page, locator) {
  const box = await locator.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 18,
  });
}

async function installVideoOverlay(page) {
  await page.addStyleTag({
    content: `
      #leverie-video-caption,
      #leverie-video-highlight {
        pointer-events: none;
      }

      #leverie-video-caption {
        position: fixed;
        left: 28px;
        bottom: 28px;
        z-index: 99999;
        width: min(720px, calc(100vw - 56px));
        padding: 22px 24px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 10px;
        background: rgba(12, 18, 24, 0.88);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        backdrop-filter: blur(14px);
      }

      #leverie-video-caption strong {
        display: block;
        margin-bottom: 6px;
        font-size: 27px;
        line-height: 1.35;
        letter-spacing: 0;
      }

      #leverie-video-caption span {
        display: block;
        color: rgba(255, 255, 255, 0.78);
        font-size: 17px;
        line-height: 1.55;
      }

      #leverie-video-highlight {
        position: fixed;
        z-index: 99998;
        border: 3px solid #0f9f7a;
        border-radius: 9px;
        box-shadow: 0 0 0 9999px rgba(8, 13, 18, 0.16), 0 12px 34px rgba(15, 159, 122, 0.28);
        opacity: 0;
        transition: all 360ms ease;
      }
    `,
  });

  await page.evaluate(() => {
    const caption = document.createElement('div');
    caption.id = 'leverie-video-caption';
    caption.innerHTML = '<strong></strong><span></span>';
    document.body.append(caption);

    const highlight = document.createElement('div');
    highlight.id = 'leverie-video-highlight';
    document.body.append(highlight);
  });
}

async function caption(page, title, detail = '') {
  await page.evaluate(
    ({ title: nextTitle, detail: nextDetail }) => {
      const captionEl = document.querySelector('#leverie-video-caption');
      if (!captionEl) return;
      const titleEl = captionEl.querySelector('strong');
      const detailEl = captionEl.querySelector('span');
      if (titleEl) titleEl.textContent = nextTitle;
      if (detailEl) detailEl.textContent = nextDetail;
    },
    { title, detail },
  );
}

async function highlight(page, locator) {
  const box = await locator.boundingBox();
  if (!box) return;
  await page.evaluate(({ x, y, width, height }) => {
    const highlightEl = document.querySelector('#leverie-video-highlight');
    if (!(highlightEl instanceof HTMLElement)) return;
    highlightEl.style.opacity = '1';
    highlightEl.style.left = `${x - 8}px`;
    highlightEl.style.top = `${y - 8}px`;
    highlightEl.style.width = `${width + 16}px`;
    highlightEl.style.height = `${height + 16}px`;
  }, box);
}

async function clearHighlight(page) {
  await page.evaluate(() => {
    const highlightEl = document.querySelector('#leverie-video-highlight');
    if (highlightEl instanceof HTMLElement) highlightEl.style.opacity = '0';
  });
}

async function clickWithFocus(page, locator) {
  await highlight(page, locator);
  await moveMouseTo(page, locator);
  await wait(450);
  await locator.click();
}

await rm(videoDir, { recursive: true, force: true });
await mkdir(videoDir, { recursive: true });
await mkdir(resolve(outputPath, '..'), { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: videoDir,
    size: { width: 1440, height: 900 },
  },
});

const page = await context.newPage();
page.on('dialog', (dialog) => dialog.accept());
await page.addInitScript((nextLang) => {
  localStorage.setItem('leverie-lang', nextLang);
  localStorage.setItem(
    'leverie-ui-prefs',
    JSON.stringify({
      leftPaneSections: { dag: true, fields: true },
      evalDrawerOpen: false,
    }),
  );
  sessionStorage.clear();
}, copy.lang);

try {
  await page.goto(`${baseUrl}/local`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  const guideClose = page.getByRole('button', {
    name: copy.selectors.guideClose,
  });
  if (await guideClose.isVisible().catch(() => false)) {
    await guideClose.click();
  }

  await installVideoOverlay(page);
  await caption(page, ...copy.captions.intro);
  await wait(2800);

  const sampleButton = page.getByRole('button', {
    name: copy.selectors.sampleButton,
  });
  await caption(page, ...copy.captions.sample);
  await highlight(page, sampleButton);
  await moveMouseTo(page, sampleButton);
  await wait(1200);
  await clickWithFocus(page, sampleButton);
  await wait(900);

  const refundCard = page
    .getByRole('heading', { name: copy.selectors.sampleHeading })
    .locator('..');
  await caption(page, ...copy.captions.refund);
  await highlight(page, refundCard);
  await wait(2500);
  await clickWithFocus(
    page,
    refundCard.getByRole('button', {
      name: copy.selectors.createFromSample,
    }),
  );

  await page.waitForTimeout(800);
  await caption(page, ...copy.captions.table);
  await clearHighlight(page);
  await wait(3200);

  const evalPanel = page.getByText(copy.selectors.evalPanel).first();
  await caption(page, ...copy.captions.test);
  await highlight(page, evalPanel);
  await wait(1200);

  await page.locator('select#f1').selectOption(copy.values.category);
  await wait(300);
  await page.locator('input#f2').fill('20');
  await wait(300);
  await page.locator('select#f3').selectOption(copy.values.tier);
  await wait(300);
  await page.locator('input#f4').fill('250');
  await wait(300);
  await page.locator('input#f5-false').check({ force: true });
  await wait(500);

  await clickWithFocus(
    page,
    page.getByRole('button', { name: copy.selectors.runEval }),
  );
  await wait(1300);

  await caption(page, ...copy.captions.result);
  await highlight(page, page.getByText(copy.selectors.result));
  await wait(3000);

  await caption(page, ...copy.captions.flowchart);
  await clickWithFocus(
    page,
    page.getByRole('button', { name: copy.selectors.flowchart }),
  );
  await page.waitForTimeout(2800);

  await caption(page, ...copy.captions.close);
  await clearHighlight(page);
  await wait(3600);
} finally {
  await context.close();
  await browser.close();
}

const recordedFiles = await readdir(videoDir);
const recordedVideo = recordedFiles.find((file) => file.endsWith('.webm'));
if (!recordedVideo) {
  throw new Error('Playwright did not produce a .webm video.');
}

await rm(outputPath, { force: true });
await rename(resolve(videoDir, recordedVideo), outputPath);
await rm(videoDir, { recursive: true, force: true });

console.log(`Created ${outputPath}`);
