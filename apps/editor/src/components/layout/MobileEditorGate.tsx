import { CheckCircle2, ChevronRight, Copy, ExternalLink } from 'lucide-react';
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
    poster: `${MEDIA_BASE_PATH}/leverie-build-logic-30s-en-poster.jpg`,
  },
  ja: {
    mp4: `${MEDIA_BASE_PATH}/leverie-build-logic-30s-ja.mp4`,
    webm: `${MEDIA_BASE_PATH}/leverie-build-logic-30s-ja.webm`,
    poster: `${MEDIA_BASE_PATH}/leverie-build-logic-30s-ja-poster.jpg`,
  },
} satisfies Record<Lang, { mp4: string; webm: string; poster: string }>;

const PRODUCT_SCREENSHOTS = [
  {
    id: 'flowchart',
    src: `${MEDIA_BASE_PATH}/leverie-flowchart.png`,
  },
] as const;

const COPY = {
  en: {
    title: 'LEVERIE is designed for larger screens',
    lead: 'Decision tables are easiest to edit when you can see fields, rules, results, and the evaluation panel together.',
    mediaTitle: 'See the editor in action',
    mediaLead:
      'Watch a short walkthrough of defining fields, entering rules, and evaluating inputs in the desktop editor.',
    screenshotsTitle: 'See your rules as a flowchart',
    screenshotsLead:
      'The editor can turn the same decision table into a readable flowchart, so you can follow the whole decision path at a glance.',
    screenshots: {
      flowchart: {
        title: 'Flowchart view',
        body: 'Built into the editor — review the decision path without touching the table.',
        alt: 'LEVERIE flowchart view screenshot',
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
    continueAnyway: 'Continue to the editor anyway',
  },
  ja: {
    title: 'LEVERIEは大きな画面での編集に向いています',
    lead: 'フィールド・ルール・結論・評価パネルを一度に見渡すことで、ロジックを編集しやすくなります。',
    mediaTitle: 'エディターの動きを見る',
    mediaLead:
      'フィールドの定義からルールの入力、評価パネルでのテストまで、PC版エディターの一連の流れを短い動画で紹介します。',
    screenshotsTitle: 'ルールをフローチャートで確認',
    screenshotsLead:
      '編集中のロジックをフローチャートでも表示できます。判断の流れをひと目で追えます。',
    screenshots: {
      flowchart: {
        title: 'フローチャート表示',
        body: 'エディターの標準機能です。表を編集しなくても、ロジックの流れを確認できます。',
        alt: 'LEVERIEのフローチャート表示のスクリーンショット',
      },
    },
    reasonTitle: 'モバイルに向いていない理由',
    reason:
      'スマートフォンでは画面の横幅が足りず、複数の条件列やルール行を見比べるのが難しくなります。セルの選び間違いや誤操作も起こりやすく、内容の確認に手間がかかります。',
    previewTitle: 'PCでできること',
    bullets: [
      'テキスト・選択肢・日付・数値など、型のあるフィールドを定義',
      '条件列とルールの優先順位を1つの表で編集',
      'テスト入力を実行し、判定の流れをステップごとに確認',
    ],
    copyLink: 'PCで開くリンクをコピー',
    copied: 'リンクをコピーしました。PCのブラウザで開いてください。',
    copyFailed: 'リンクをコピーできませんでした。',
    docs: 'ドキュメントを見る',
    continueAnyway: 'それでもこのまま開く',
  },
} satisfies Record<Lang, unknown>;

interface Props {
  lang: Lang;
  setLang: (lang: Lang) => void;
  onContinueAnyway: () => void;
}

export function MobileEditorGate({ lang, setLang, onContinueAnyway }: Props) {
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

          <section className="mt-6">
            <h2 className="text-sm font-semibold text-fg">{c.reasonTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-fg-muted">{c.reason}</p>
          </section>

          <section className="mt-6">
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

          <button
            type="button"
            onClick={onContinueAnyway}
            className="mt-4 inline-flex items-center justify-center gap-1 self-center text-xs font-medium text-fg-subtle underline decoration-line underline-offset-2 transition-colors hover:text-fg-secondary"
          >
            <span>{c.continueAnyway}</span>
            <ChevronRight size={13} />
          </button>

          <section className="mt-8 border-t border-line pt-6">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-fg">{c.mediaTitle}</h2>
              <p className="mt-1 text-sm leading-6 text-fg-muted">
                {c.mediaLead}
              </p>
            </div>
            <div className="overflow-hidden rounded border border-line bg-surface shadow-sm">
              <video
                aria-label={c.mediaTitle}
                className="aspect-video w-full bg-surface-muted"
                controls
                muted
                playsInline
                preload="metadata"
                poster={video.poster}
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
        </section>
      </div>
    </main>
  );
}
