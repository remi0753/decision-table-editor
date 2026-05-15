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
import type { CoverageGap } from '@/engine/checks';
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
interface ConditionNodeData extends BaseNodeData {
  fieldName?: string;
}
interface ContinueNodeData extends BaseNodeData {
  targetTableId?: string;
}

// ---- Custom Node components ----

function RootNode({ data }: NodeProps) {
  const d = data as BaseNodeData;
  return (
    <>
      <div
        className={cn(
          'px-4 py-2 rounded-full border-2 border-gray-400 bg-white text-gray-600 text-xs font-semibold text-center select-none',
          d.highlighted && 'border-violet-500 ring-2 ring-violet-300',
        )}
      >
        {d.label}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400"
      />
    </>
  );
}

function ConditionNode({ data }: NodeProps) {
  const d = data as ConditionNodeData;
  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div
        className={cn(
          'rounded border-2 border-gray-300 bg-white text-xs select-none overflow-hidden',
          d.highlighted && 'border-violet-400 ring-1 ring-violet-300',
        )}
        style={{ width: 160 }}
      >
        {d.fieldName && (
          <div className="bg-gray-100 px-2 py-0.5 text-gray-500 font-medium truncate border-b border-gray-200 text-center">
            {d.fieldName}
          </div>
        )}
        <div className="px-2 py-1.5 text-gray-700 text-center font-mono truncate">
          {d.label}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400"
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
      <Handle type="target" position={Position.Top} className="!bg-green-400" />
      <div
        className={cn(
          'rounded border-2 border-green-400 bg-green-50 text-xs select-none overflow-hidden',
          d.highlighted && 'ring-2 ring-green-600',
        )}
        style={{ width: 180 }}
      >
        <div className="bg-green-100 px-2 py-0.5 text-green-700 font-medium text-center border-b border-green-200">
          ✓ {t.conclusion}
        </div>
        <div className="px-2 py-1.5 space-y-0.5">
          {lines.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static label lines have no stable ID
            <div key={`${i}-${line}`} className="text-green-800 truncate">
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
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-violet-400"
      />
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'px-3 py-2.5 rounded border-2 border-violet-400 bg-violet-50 text-xs text-violet-700 font-medium text-center cursor-pointer hover:bg-violet-100 select-none',
          d.highlighted && 'ring-2 ring-violet-600',
        )}
        style={{ width: 180 }}
      >
        {d.label}
      </button>
    </>
  );
}

function PhantomConditionNode({ data }: NodeProps) {
  const d = data as ConditionNodeData;
  const t = useT();
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-yellow-400"
      />
      <div
        className="rounded border-2 border-dashed border-yellow-400 bg-yellow-50/60 text-xs select-none overflow-hidden"
        style={{ width: 160 }}
        title={t.phantomNodeTitle}
      >
        {d.fieldName && (
          <div className="bg-yellow-100/70 px-2 py-0.5 text-yellow-700 font-medium truncate border-b border-dashed border-yellow-300 text-center">
            {d.fieldName}
          </div>
        )}
        <div className="px-2 py-1.5 text-yellow-800 text-center font-mono truncate">
          {d.label}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-yellow-400"
      />
    </>
  );
}

function PhantomDeadendNode({ data }: NodeProps) {
  const d = data as BaseNodeData;
  const t = useT();
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-yellow-500"
      />
      <div
        className="rounded border-2 border-dashed border-yellow-500 bg-yellow-50 text-xs select-none overflow-hidden"
        style={{ width: 160 }}
        title={t.phantomNodeTitle}
      >
        <div className="px-3 py-2 text-yellow-800 text-center font-medium">
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
      if (node.type === 'continueNode') return;
      onNodeClick(node.data.rowIds as string[], node.type ?? '');
    },
    [onNodeClick],
  );

  if (!table) return null;

  if (table.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
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
