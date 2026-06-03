import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.env.LEVERIE_VIDEO_BASE_URL ?? 'http://127.0.0.1:5173';
const lang = process.env.LEVERIE_VIDEO_LANG === 'en' ? 'en' : 'ja';
const outputPath = resolve(
  process.env.LEVERIE_VIDEO_OUTPUT ??
    `artifacts/leverie-build-logic-30s-${lang}.webm`,
);
const videoDir = resolve(`artifacts/.build-video-recording-${lang}`);

const copy = {
  ja: {
    lang: 'ja',
    guideClose: 'ガイドを閉じる',
    title: 'イベント申請の振り分け',
    description:
      '申請チーム、イベント種別、開催日、予算から承認・レビュー先を判断します。',
    tableName: '振り分けルール',
    outputCol: '判定',
    fields: [
      { name: '申請チーム', type: 'string' },
      {
        name: 'イベント種別',
        type: 'enum',
        enumValues: [
          'ウェビナー',
          'ワークショップ',
          'カンファレンス',
          'VIP面談',
        ],
      },
      { name: '開催日', type: 'date' },
      { name: '予算', type: 'number' },
    ],
    rules: [
      { team: ['contains', '役員'], result: '役員イベント担当へ' },
      { type: ['=', 'VIP面談'], result: 'エグゼクティブ対応' },
      { date: ['<=', '2026-07-15'], result: '緊急オペレーション確認' },
      {
        type: ['=', 'カンファレンス'],
        budget: ['>=', '50000'],
        result: '財務・購買レビュー',
      },
      {
        type: ['=', 'カンファレンス'],
        budget: ['>=', '15000'],
        result: 'イベント運営レビュー',
      },
      {
        type: ['=', 'ワークショップ'],
        budget: ['>=', '10000'],
        result: '部門マネージャー承認',
      },
      {
        type: ['=', 'ウェビナー'],
        budget: ['<=', '3000'],
        result: '自動承認',
      },
      {
        type: ['=', 'ウェビナー'],
        budget: ['>', '3000'],
        result: 'マーケティング運営レビュー',
      },
      { date: ['>=', '2026-12-01'], result: '年間計画キュー' },
      { result: '標準イベントレビュー' },
    ],
    evalCase: {
      team: 'マーケティング',
      type: 'カンファレンス',
      date: '2026-08-20',
      budget: '55000',
    },
    selectors: {
      runEval: /評価実行/,
      result: '✓ 評価結果',
    },
    captions: {
      intro: [
        'サンプルなしでロジックを作成',
        '現実にありそうなイベント申請の振り分けルールを、空の表から入力します。',
      ],
      fields: [
        '4つのフィールドを定義',
        'テキスト、Enum、日付、数値を入力として使います。',
      ],
      columns: [
        '4つの条件列を配置',
        '各列をフィールドに紐づけ、判定表の骨格を作ります。',
      ],
      rules: [
        '10ルールを入力',
        '緊急対応、VIP、予算、開催時期など、実務でありそうな条件を並べます。',
      ],
      done: [
        '評価パネルで試す',
        '入力ケースを実行し、どのルールにマッチしたかまで確認します。',
      ],
      result: [
        '結果とトレースまで確認',
        '完成したルールが、財務・購買レビューに振り分けることを確認できます。',
      ],
    },
  },
  en: {
    lang: 'en',
    guideClose: 'Close guide',
    title: 'Event request routing',
    description:
      'Route approvals from requester team, event type, event date, and budget.',
    tableName: 'Routing rules',
    outputCol: 'Decision',
    fields: [
      { name: 'Requester team', type: 'string' },
      {
        name: 'Event type',
        type: 'enum',
        enumValues: ['Webinar', 'Workshop', 'Conference', 'VIP briefing'],
      },
      { name: 'Event date', type: 'date' },
      { name: 'Budget', type: 'number' },
    ],
    rules: [
      { team: ['contains', 'Executive'], result: 'Executive events desk' },
      { type: ['=', 'VIP briefing'], result: 'Executive support' },
      { date: ['<=', '2026-07-15'], result: 'Expedited operations review' },
      {
        type: ['=', 'Conference'],
        budget: ['>=', '50000'],
        result: 'Finance and procurement review',
      },
      {
        type: ['=', 'Conference'],
        budget: ['>=', '15000'],
        result: 'Event operations review',
      },
      {
        type: ['=', 'Workshop'],
        budget: ['>=', '10000'],
        result: 'Department manager approval',
      },
      {
        type: ['=', 'Webinar'],
        budget: ['<=', '3000'],
        result: 'Auto approve',
      },
      {
        type: ['=', 'Webinar'],
        budget: ['>', '3000'],
        result: 'Marketing operations review',
      },
      { date: ['>=', '2026-12-01'], result: 'Annual planning queue' },
      { result: 'Standard event review' },
    ],
    evalCase: {
      team: 'Marketing',
      type: 'Conference',
      date: '2026-08-20',
      budget: '55000',
    },
    selectors: {
      runEval: /Evaluate/,
      result: '✓ Result',
    },
    captions: {
      intro: [
        'Build a logic without samples',
        'Create a realistic event-request routing policy from a blank table.',
      ],
      fields: [
        'Define four fields',
        'Use text, enum, date, and number inputs in the same decision table.',
      ],
      columns: [
        'Add four condition columns',
        'Connect each column to a field and create the table structure.',
      ],
      rules: [
        'Enter ten rules',
        'Capture realistic cases for urgency, VIP handling, budget, and timing.',
      ],
      done: [
        'Try it in the evaluation panel',
        'Run one input case and see exactly which rule matched.',
      ],
      result: [
        'Confirm the result and trace',
        'The new logic routes the case to finance and procurement review.',
      ],
    },
  },
}[lang];

const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

async function moveMouseTo(page, locator) {
  const box = await locator.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 12,
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
        width: min(760px, calc(100vw - 56px));
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
        box-shadow: 0 0 0 9999px rgba(8, 13, 18, 0.12), 0 12px 34px rgba(15, 159, 122, 0.24);
        opacity: 0;
        transition: all 280ms ease;
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

// async function clearHighlight(page) {
//   await page.evaluate(() => {
//     const highlightEl = document.querySelector('#leverie-video-highlight');
//     if (highlightEl instanceof HTMLElement) highlightEl.style.opacity = '0';
//   });
// }

async function clickWithFocus(page, locator) {
  await highlight(page, locator);
  await moveMouseTo(page, locator);
  await wait(220);
  await locator.click();
}

// The app exposes its live store instances on window in dev (see
// apps/editor/src/main.tsx). A page-context `import()` of the store module
// resolves to a separate copy under the bundled dev setup, so we read the real
// stores off window to drive the same state the UI shows.
async function runStore(page, script, args = {}) {
  await page.evaluate(
    ({ script: body, args: fnArgs }) => {
      const useLogicStore = window.__leverieLogicStore;
      return Function('store', 'args', body)(useLogicStore.getState(), fnArgs);
    },
    { script, args },
  );
}

async function runAppStores(page, script, args = {}) {
  await page.evaluate(
    ({ script: body, args: fnArgs }) => {
      const useLogicStore = window.__leverieLogicStore;
      const useUiStore = window.__leverieUiStore;
      return Function(
        'logicStore',
        'uiStore',
        'args',
        body,
      )(useLogicStore.getState(), useUiStore.getState(), fnArgs);
    },
    { script, args },
  );
}

async function addField(page, field) {
  // Field editing now lives in a dialog: open it from the add button, fill the
  // type and name, then submit (which closes the dialog) before the next field.
  await clickWithFocus(page, page.locator('[data-tour-target="field-add"]'));
  await wait(240);
  await page
    .locator('[data-tour-target="field-type-select"]')
    .selectOption(field.type);
  const input = page.locator('[data-tour-target="field-name-input"]');
  await input.fill('');
  await input.pressSequentially(field.name, { delay: 7 });
  await clickWithFocus(page, page.locator('[data-tour-target="field-submit"]'));
  await wait(300);
}

await rm(videoDir, { recursive: true, force: true });
await mkdir(videoDir, { recursive: true });
await mkdir(resolve(outputPath, '..'), { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1680, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: videoDir,
    size: { width: 1680, height: 900 },
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
  const guideClose = page.getByRole('button', { name: copy.guideClose });
  if (await guideClose.isVisible().catch(() => false)) {
    await guideClose.click();
  }

  await installVideoOverlay(page);
  await runStore(
    page,
    'store.setLogicName(args.title); store.setLogicDescription(args.description);',
    {
      title: copy.title,
      description: copy.description,
    },
  );
  await caption(page, ...copy.captions.intro);
  await wait(1600);

  await caption(page, ...copy.captions.fields);
  await highlight(page, page.locator('[data-tour-target="field-add"]'));
  for (const field of copy.fields) {
    await addField(page, field);
  }
  await runStore(
    page,
    `
      store.renameTable('t1', args.tableName);
      store.renameOutputCol('t1', 'oc1', args.outputCol);
      for (const value of args.enumValues) {
        store.addEnumValue('f2', value);
      }
    `,
    {
      tableName: copy.tableName,
      outputCol: copy.outputCol,
      enumValues: copy.fields[1].enumValues,
    },
  );
  await wait(500);

  await caption(page, ...copy.captions.columns);
  const addColButton = page
    .locator('[data-tour-target="condition-add"]')
    .first();
  for (let i = 0; i < 4; i += 1) {
    await clickWithFocus(page, addColButton);
    await wait(180);
  }
  const fieldSelects = page.locator(
    '[data-tour-target="condition-field-select"]',
  );
  for (let i = 0; i < 4; i += 1) {
    await fieldSelects.nth(i).selectOption(`f${i + 1}`);
    await wait(120);
  }
  await wait(420);

  await caption(page, ...copy.captions.rules);
  await highlight(page, page.locator('table').first());
  for (const rule of copy.rules) {
    await runStore(
      page,
      `
        const rowId = store.addRow('t1');
        if (!rowId) return;
        if (args.team) store.setCell('t1', rowId, 'c1', { op: args.team[0], val: args.team[1] });
        if (args.type) store.setCell('t1', rowId, 'c2', { op: args.type[0], val: args.type[1] });
        if (args.date) store.setCell('t1', rowId, 'c3', { op: args.date[0], val: args.date[1] });
        if (args.budget) store.setCell('t1', rowId, 'c4', { op: args.budget[0], val: args.budget[1] });
        store.setConclusion('t1', rowId, {
          type: 'terminal',
          outputs: { oc1: args.result },
        });
      `,
      rule,
    );
    await wait(150);
  }
  await wait(900);

  await caption(page, ...copy.captions.done);
  await runAppStores(
    page,
    `
      uiStore.setEvalDrawerOpen(true);
      uiStore.clearEvalInputs();
      uiStore.clearEvalResult();
    `,
  );
  await wait(500);
  // Single-output conclusions no longer render the output column name as a
  // chip label, so highlight the evaluation inputs the caption refers to.
  await highlight(page, page.locator('[data-tour-target="eval-inputs"]'));
  await page.locator('input#f1').fill(copy.evalCase.team);
  await wait(160);
  await page.locator('select#f2').selectOption(copy.evalCase.type);
  await wait(160);
  await page.locator('input#f3').fill(copy.evalCase.date);
  await wait(160);
  await page.locator('input#f4').fill(copy.evalCase.budget);
  await wait(260);
  await clickWithFocus(
    page,
    page.getByRole('button', { name: copy.selectors.runEval }),
  );
  await wait(650);

  await caption(page, ...copy.captions.result);
  await highlight(page, page.getByText(copy.selectors.result));
  await wait(2600);
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
