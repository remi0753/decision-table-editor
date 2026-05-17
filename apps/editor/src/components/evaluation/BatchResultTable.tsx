import type { BatchCaseResult, Logic } from '@leverie/engine';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useT } from '@/i18n/useT';
import { TraceView } from './TraceView';

interface Props {
  results: BatchCaseResult[];
  logic: Logic;
}

export function BatchResultTable({ results, logic }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const t = useT();

  const totalCount = results.length;
  const matchCount = results.filter((r) => r.result.status === 'ok').length;
  const noMatchCount = totalCount - matchCount;
  const withExpected = results.filter((r) => r.pass !== null);
  const passCount = withExpected.filter((r) => r.pass === true).length;
  const failCount = withExpected.filter((r) => r.pass === false).length;

  const toggle = (i: number) =>
    setExpandedIndex((prev) => (prev === i ? null : i));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="text-gray-600">{t.totalCases(totalCount)}</span>
        <span className="text-green-600">{t.matchedCases(matchCount)}</span>
        {noMatchCount > 0 && (
          <span className="text-red-500">{t.noMatchCases(noMatchCount)}</span>
        )}
        {withExpected.length > 0 && (
          <>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">
              {t.withExpected(withExpected.length)}
            </span>
            <span className="text-green-600">Pass {passCount}</span>
            {failCount > 0 && (
              <span className="text-red-500">Fail {failCount}</span>
            )}
          </>
        )}
      </div>

      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              <th className="px-2 py-1.5 text-left w-6"></th>
              <th className="px-2 py-1.5 text-left w-8">#</th>
              <th className="px-2 py-1.5 text-left">{t.caseName}</th>
              <th className="px-2 py-1.5 text-left">{t.resultCol}</th>
              <th className="px-2 py-1.5 text-left">{t.expectedCol}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <Fragment key={r.batchCase.name}>
                <tr
                  onClick={() => toggle(i)}
                  className="cursor-pointer hover:bg-gray-50 border-t"
                >
                  <td className="px-2 py-1.5 text-gray-400">
                    {expandedIndex === i ? (
                      <ChevronDown size={12} />
                    ) : (
                      <ChevronRight size={12} />
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-1.5 text-gray-800">
                    {r.batchCase.name}
                  </td>
                  <td className="px-2 py-1.5">
                    {r.result.status === 'ok' ? (
                      <span className="text-green-600">{t.matchedResult}</span>
                    ) : (
                      <span className="text-red-500">{t.noMatchResult}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {r.pass === null ? (
                      <span className="text-gray-400">-</span>
                    ) : r.pass ? (
                      <span className="text-green-600">✓ Pass</span>
                    ) : (
                      <span className="text-red-500">✗ Fail</span>
                    )}
                  </td>
                </tr>
                {expandedIndex === i && (
                  <tr>
                    <td colSpan={5} className="px-4 py-3 bg-gray-50 border-t">
                      <TraceView result={r.result} logic={logic} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">{t.clickForTrace}</p>
    </div>
  );
}
