import { CheckCircle2, Copy, ExternalLink } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import logoUrl from '@/assets/logo.svg';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import type { Lang } from '@/i18n/translations';

const MEDIA_BASE_PATH = '/media';

const PRODUCT_VIDEO = {
  en: {
    mp4: `${MEDIA_BASE_PATH}/leverie-build-logic-30s-en.mp4`,
    webm: `${MEDIA_BASE_PATH}/leverie-build-logic-30s-en.webm`,
  },
  ja: {
    mp4: `${MEDIA_BASE_PATH}/leverie-build-logic-30s-ja.mp4`,
    webm: `${MEDIA_BASE_PATH}/leverie-build-logic-30s-ja.webm`,
  },
} satisfies Record<Lang, { mp4: string; webm: string }>;

const PRODUCT_SCREENSHOTS = [
  {
    id: 'flowchart',
    src: `${MEDIA_BASE_PATH}/leverie-flowchart.png`,
  },
  {
    id: 'publishDiff',
    src: `${MEDIA_BASE_PATH}/leverie-publish-diff.png`,
  },
  {
    id: 'apiUsage',
    src: `${MEDIA_BASE_PATH}/leverie-api-usage.png`,
  },
] as const;

const COPY = {
  en: {
    title: 'LEVERIE is designed for larger screens',
    lead: 'Decision tables are easiest to edit when you can see fields, rules, results, and the evaluation panel together.',
    mediaTitle: 'See the editor in action',
    mediaLead:
      'Watch a short walkthrough of defining fields, entering rules, and evaluating inputs in the desktop editor.',
    mediaLink: 'Open video',
    screenshotsTitle: 'More desktop workflows',
    screenshotsLead:
      'Flowcharts are part of the editor. Signed-in cloud workspaces also let you review diffs before publishing and use published logic via API.',
    screenshots: {
      flowchart: {
        title: 'Flowchart view',
        body: 'Turn table rules into a readable decision path for review.',
        alt: 'LEVERIE flowchart view screenshot',
      },
      publishDiff: {
        title: 'Publish review diff',
        body: 'This is the confirmation screen shown before publishing, where you review changed, added, and removed rules.',
        alt: 'LEVERIE publish diff review screenshot',
      },
      apiUsage: {
        title: 'API usage after publish',
        body: 'Publishing logic and using it via the API require signing in to a cloud workspace.',
        alt: 'LEVERIE API usage dialog screenshot',
      },
    },
    reasonTitle: 'Why mobile is limited',
    reason:
      'On a phone, the table becomes too narrow to compare multiple condition columns and rule rows. That makes review harder and increases the chance of editing the wrong cell.',
    previewTitle: 'What you can do on desktop',
    bullets: [
      'Define typed fields such as text, enum, date, and number',
      'Edit condition columns and rule priority in one table',
      'Run test inputs with a step-by-step execution trace',
    ],
    copyLink: 'Copy desktop link',
    copied: 'Link copied. Open it on a desktop browser.',
    copyFailed: 'Could not copy the link.',
    docs: 'View docs',
    note: 'Open this URL on a desktop or large tablet to use the editor.',
  },
  ja: {
    title: 'LEVERIEは大きな画面での編集に最適化されています',
    lead: '決定表は、フィールド・ルール・結論・評価パネルを同時に見ながら編集すると扱いやすくなります。',
    mediaTitle: 'エディターの動きを見る',
    mediaLead:
      'フィールド定義、ルール入力、評価パネルでのテストまで、PC版エディターの流れを短い動画で確認できます。',
    mediaLink: '動画を開く',
    screenshotsTitle: 'PCで確認できるワークフロー',
    screenshotsLead:
      'フローチャートはエディターで使える機能です。サインイン後のクラウドワークスペースでは、公開前の差分確認や公開済みロジックのAPI利用もできます。',
    screenshots: {
      flowchart: {
        title: 'フローチャート表示',
        body: '表のルールをレビューしやすい判断経路として確認できます。',
        alt: 'LEVERIEのフローチャート表示のスクリーンショット',
      },
      publishDiff: {
        title: '公開前の差分確認',
        body: 'これはロジック公開前の確認画面です。本番反映前に、変更・追加・削除されたルールを確認できます。',
        alt: 'LEVERIEの公開差分レビューのスクリーンショット',
      },
      apiUsage: {
        title: '公開後のAPI利用',
        body: 'ロジックの公開とAPI経由での利用には、クラウドワークスペースへのサインインが必要です。',
        alt: 'LEVERIEのAPI利用ダイアログのスクリーンショット',
      },
    },
    reasonTitle: 'モバイルに向いていない理由',
    reason:
      'スマートフォンでは表の横幅が足りず、複数の条件列やルール行を比較しながら確認しづらくなります。セルの選択や編集の誤操作も起きやすくなります。',
    previewTitle: 'PCでできること',
    bullets: [
      'テキスト、Enum、日付、数値などの型付きフィールドを定義',
      '条件列とルールの優先順を1つの表で編集',
      'テスト入力を実行し、ステップごとの実行トレースを確認',
    ],
    copyLink: 'PCで開くリンクをコピー',
    copied: 'リンクをコピーしました。PCブラウザで開いてください。',
    copyFailed: 'リンクをコピーできませんでした。',
    docs: 'ドキュメントを見る',
    note: 'このURLをPC、または大きめのタブレットで開くとエディターを利用できます。',
  },
} satisfies Record<Lang, unknown>;

interface Props {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export function MobileEditorGate({ lang, setLang }: Props) {
  const c = COPY[lang];
  const video = PRODUCT_VIDEO[lang];

  useEffect(() => {
    toast.dismiss('new-logic-created');
    toast.dismiss('cloud-session-checking');
  }, []);

  const copyCurrentUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(c.copied);
    } catch {
      toast.error(c.copyFailed);
    }
  };

  return (
    <main className="flex min-h-[100svh] flex-col overflow-x-hidden bg-surface text-fg">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-brand-border bg-gradient-to-r from-brand-subtle to-surface px-3">
        <div className="flex min-w-0 items-center">
          <img src={logoUrl} alt="LEVERIE" height={34} className="h-[34px]" />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            className="rounded border border-line bg-surface px-2 py-1.5 text-xs font-medium text-fg-subtle cursor-pointer hover:border-brand-border hover:bg-brand-subtle focus:outline-none focus:ring-1 focus:ring-brand-ring"
          >
            <option value="en">EN</option>
            <option value="ja">日本語</option>
          </select>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col px-5">
        <section className="flex flex-1 flex-col justify-center py-8">
          <h1 className="text-2xl font-semibold leading-tight text-fg">
            {c.title}
          </h1>
          <p className="mt-3 text-base leading-7 text-fg-muted">{c.lead}</p>

          <section className="mt-7">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-fg">
                  {c.mediaTitle}
                </h2>
                <p className="mt-1 text-sm leading-6 text-fg-muted">
                  {c.mediaLead}
                </p>
              </div>
              <a
                href={video.mp4}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-0.5 inline-flex shrink-0 items-center gap-1.5 rounded border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-fg-secondary transition-colors hover:bg-surface-muted"
              >
                <ExternalLink size={14} />
                <span>{c.mediaLink}</span>
              </a>
            </div>
            <div className="overflow-hidden rounded border border-line bg-surface shadow-sm">
              <video
                aria-label={c.mediaTitle}
                className="aspect-video w-full bg-surface-muted"
                controls
                muted
                playsInline
                preload="metadata"
              >
                <source src={video.webm} type="video/webm" />
                <source src={video.mp4} type="video/mp4" />
              </video>
            </div>
          </section>

          <section className="mt-7">
            <h2 className="text-sm font-semibold text-fg">
              {c.screenshotsTitle}
            </h2>
            <p className="mt-1 text-sm leading-6 text-fg-muted">
              {c.screenshotsLead}
            </p>
            <div className="mt-3 grid gap-4">
              {PRODUCT_SCREENSHOTS.map((screenshot) => {
                const item = c.screenshots[screenshot.id];
                return (
                  <article
                    key={screenshot.id}
                    className="overflow-hidden rounded border border-line bg-surface shadow-sm"
                  >
                    <img
                      src={screenshot.src}
                      alt={item.alt}
                      className="aspect-[16/10] w-full bg-surface-muted object-cover object-left-top"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="border-t border-line px-3 py-3">
                      <h3 className="text-sm font-semibold text-fg">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-fg-muted">
                        {item.body}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="mt-7 border-t border-line pt-5">
            <h2 className="text-sm font-semibold text-fg">{c.reasonTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-fg-muted">{c.reason}</p>
          </section>

          <section className="mt-5">
            <h2 className="text-sm font-semibold text-fg">{c.previewTitle}</h2>
            <ul className="mt-3 space-y-2">
              {c.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex gap-2 text-sm leading-6 text-fg-muted"
                >
                  <CheckCircle2
                    size={16}
                    className="mt-1 shrink-0 text-success-fg"
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-7 grid gap-3">
            <button
              type="button"
              onClick={() => void copyCurrentUrl()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded bg-brand px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-strong"
            >
              <Copy size={17} />
              <span>{c.copyLink}</span>
            </button>
            <a
              href="/docs/introduction"
              className="inline-flex h-11 items-center justify-center gap-2 rounded border border-line bg-surface px-4 text-sm font-semibold text-fg-secondary transition-colors hover:bg-surface-muted"
            >
              <ExternalLink size={17} />
              <span>{c.docs}</span>
            </a>
          </div>

          <p className="mt-4 text-center text-xs leading-5 text-fg-subtle">
            {c.note}
          </p>
        </section>
      </div>
    </main>
  );
}
