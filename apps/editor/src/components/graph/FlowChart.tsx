import {
  Background,
  Controls,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from '@xyflow/react';
import { useCallback, useMemo } from 'react';
import '@xyflow/react/dist/style.css';
import type { CoverageGap } from '@leverie/checks';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';
import { buildFlowChart } from '@/utils/buildFlowChart';

// ---- Custom node data types ----

interface BaseNodeData extends Record<string, unknown> {
  label: string;
  rowIds: string[];
  highlighted: boolean;
}
interface ContinueNodeData extends BaseNodeData {
  targetTableId?: string;
}
interface SwimlaneHeaderNodeData extends BaseNodeData {
  _w: number;
}

// ---- Custom Node components ----

function RootNode({ data }: NodeProps) {
  const d = data as BaseNodeData;
  return (
    <>
      <div
        className={cn(
          'px-4 py-2 rounded-full border-2 border-line-strong bg-surface text-fg-muted text-xs font-semibold text-center select-none',
          d.highlighted && 'border-brand-border-strong ring-2 ring-brand-ring',
        )}
      >
        {d.label}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-surface-strong"
      />
    </>
  );
}

function ConditionNode({ data }: NodeProps) {
  const d = data as BaseNodeData;
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-surface-strong"
      />
      <div
        className={cn(
          'rounded border-2 border-line-strong bg-surface text-xs select-none overflow-hidden',
          d.highlighted && 'border-brand-border-strong ring-1 ring-brand-ring',
        )}
        style={{ width: 160 }}
      >
        <div className="px-2 py-1.5 text-fg-secondary text-center font-mono truncate">
          {d.label}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-surface-strong"
      />
    </>
  );
}

function TerminalNode({ data }: NodeProps) {
  const d = data as BaseNodeData;
  const t = useT();
  const lines = d.label.split('\n');
  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-success" />
      <div
        className={cn(
          'rounded border-2 border-success-border bg-success-bg text-xs select-none overflow-hidden',
          d.highlighted && 'ring-2 ring-success',
        )}
        style={{ width: 180 }}
      >
        <div className="bg-success-bg px-2 py-0.5 text-success-fg font-medium text-center border-b border-success-border">
          ✓ {t.conclusion}
        </div>
        <div className="px-2 py-1.5 space-y-0.5">
          {lines.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static label lines have no stable ID
            <div key={`${i}-${line}`} className="text-success-fg truncate">
              {line}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ContinueNode({ data }: NodeProps) {
  const d = data as ContinueNodeData;
  const setSelectedTable = useUiStore((s) => s.setSelectedTable);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (d.targetTableId) setSelectedTable(d.targetTableId);
  };

  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-brand" />
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'px-3 py-2.5 rounded border-2 border-brand-border-strong bg-brand-subtle text-xs text-brand-fg font-medium text-center cursor-pointer hover:bg-brand-soft select-none',
          d.highlighted && 'ring-2 ring-brand-ring',
        )}
        style={{ width: 180 }}
      >
        {d.label}
      </button>
    </>
  );
}

function PhantomConditionNode({ data }: NodeProps) {
  const d = data as BaseNodeData;
  const t = useT();
  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-warning" />
      <div
        className="rounded border-2 border-dashed border-warning-border bg-warning-bg/60 text-xs select-none overflow-hidden"
        style={{ width: 160 }}
        title={t.phantomNodeTitle}
      >
        <div className="px-2 py-1.5 text-warning-fg text-center font-mono truncate">
          {d.label}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-warning" />
    </>
  );
}

function SwimlaneHeaderNode({ data }: NodeProps) {
  const d = data as SwimlaneHeaderNodeData;
  return (
    <div
      className="px-2 py-1 rounded bg-surface-subtle border border-line text-fg-secondary text-xs font-semibold text-center truncate select-none pointer-events-none"
      style={{ width: d._w }}
      title={d.label}
    >
      {d.label}
    </div>
  );
}

function PhantomDeadendNode({ data }: NodeProps) {
  const d = data as BaseNodeData;
  const t = useT();
  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-warning" />
      <div
        className="rounded border-2 border-dashed border-warning-border bg-warning-bg text-xs select-none overflow-hidden"
        style={{ width: 160 }}
        title={t.phantomNodeTitle}
      >
        <div className="px-3 py-2 text-warning-fg text-center font-medium">
          ⚠️ {d.label}
        </div>
      </div>
    </>
  );
}

const nodeTypes = {
  rootNode: RootNode,
  conditionNode: ConditionNode,
  terminalNode: TerminalNode,
  continueNode: ContinueNode,
  phantomConditionNode: PhantomConditionNode,
  phantomDeadendNode: PhantomDeadendNode,
  swimlaneHeaderNode: SwimlaneHeaderNode,
};

// ---- FlowChart component ----

interface Props {
  tableId: string;
  highlightedRowIds: Set<string>;
  onNodeClick: (rowIds: string[], nodeType: string) => void;
  coverageGaps?: CoverageGap[];
}

export function FlowChart({
  tableId,
  highlightedRowIds,
  onNodeClick,
  coverageGaps,
}: Props) {
  const logic = useLogicStore((s) => s.logic);
  const t = useT();
  const table = logic.tables[tableId];

  const { nodes: rawNodes, edges } = useMemo(() => {
    if (!table) return { nodes: [], edges: [] };
    return buildFlowChart(table, logic, t, coverageGaps);
  }, [table, logic, t, coverageGaps]);

  const nodes = useMemo(
    () =>
      rawNodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          highlighted: (n.data.rowIds as string[]).some((id) =>
            highlightedRowIds.has(id),
          ),
        },
      })),
    [rawNodes, highlightedRowIds],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'continueNode' || node.type === 'swimlaneHeaderNode')
        return;
      onNodeClick(node.data.rowIds as string[], node.type ?? '');
    },
    [onNodeClick],
  );

  if (!table) return null;

  if (table.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-fg-faint text-sm">
        {t.flowchartAddRows}
      </div>
    );
  }

  return (
    <div className="h-[480px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
