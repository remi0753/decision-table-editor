import { useEffect, useRef, useState } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';
import { useLogicStore } from '@/store/logicStore';

const MAX_DESCRIPTION_LENGTH = 500;

export function LogicDescriptionField() {
  const description = useLogicStore((s) => s.logic.description ?? '');
  const setLogicDescription = useLogicStore((s) => s.setLogicDescription);
  const t = useT();
  const [draft, setDraft] = useState(description);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipCommitRef = useRef(false);

  useEffect(() => {
    if (!focused) setDraft(description);
  }, [description, focused]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: draft/focused are intentional triggers — they change the rendered content/rows, requiring height recalculation.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draft, focused]);

  const commit = () => {
    const next = draft.trim();
    if (next !== description) setLogicDescription(next);
  };

  const remaining = MAX_DESCRIPTION_LENGTH - draft.length;
  const showCount = focused || remaining <= 80;

  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label
          htmlFor="logic-description"
          className="text-xs font-medium tracking-wide text-gray-400"
        >
          {t.logicDescriptionLabel}
        </label>
        {showCount ? (
          <span
            className={cn(
              'text-[10px] tabular-nums',
              remaining <= 40 ? 'text-amber-600' : 'text-gray-400',
            )}
          >
            {draft.length}/{MAX_DESCRIPTION_LENGTH}
          </span>
        ) : null}
      </div>
      <textarea
        id="logic-description"
        ref={textareaRef}
        value={draft}
        maxLength={MAX_DESCRIPTION_LENGTH}
        rows={focused ? 3 : 2}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          if (skipCommitRef.current) {
            skipCommitRef.current = false;
          } else {
            commit();
          }
          setFocused(false);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape') {
            skipCommitRef.current = true;
            setDraft(description);
            textareaRef.current?.blur();
          }
        }}
        placeholder={t.logicDescriptionPlaceholder}
        className={cn(
          'block max-h-36 min-h-[3.25rem] w-full resize-none rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs leading-5 text-gray-700 placeholder:text-gray-400 hover:border-violet-200 hover:bg-white focus:border-violet-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-300',
          focused ? 'overflow-y-auto' : 'overflow-hidden',
        )}
      />
    </div>
  );
}
