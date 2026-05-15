import type { Edge, Node } from '@xyflow/react';
import dagre from 'dagre';
import type { CoverageGap } from '@/engine/checks';
import type { TranslationSet } from '@/i18n/translations';
import type { Cell, Logic, Table } from '@/types/logic';

// ---- Trie types ----

interface TrieNode {
  id: string;
  parentId: string | null;
  nodeType:
    | 'root'
    | 'condition'
    | 'terminal'
    | 'continue'
    | 'phantomCondition'
    | 'phantomDeadend';
  colId?: string;
  cell?: Cell;
  outputs?: Record<string, string>;
  targetTableId?: string;
  rowIds: string[];
  children: Map<string, TrieNode>;
}

let _counter = 0;

function makeTrieNode(
  parentId: string | null,
  nodeType: TrieNode['nodeType'],
  extra: Partial<TrieNode> = {},
): TrieNode {
  return {
    id: `fn${_counter++}`,
    parentId,
    nodeType,
    rowIds: [],
    children: new Map(),
    ...extra,
  };
}

function cellKey(colId: string, cell: Cell): string {
  return `${colId}|${cell.op}|${JSON.stringify(cell.val ?? null)}`;
}

function buildTrie(table: Table): TrieNode {
  _counter = 0;
  const root = makeTrieNode(null, 'root');

  for (const row of table.rows) {
    let cur = root;
    cur.rowIds.push(row.id);

    for (const col of table.cols) {
      const cell = row.cells[col.id];
      if (!cell) continue;

      const key = cellKey(col.id, cell);
      if (!cur.children.has(key)) {
        cur.children.set(
          key,
          makeTrieNode(cur.id, 'condition', { colId: col.id, cell }),
        );
      }
      cur = cur.children.get(key)!;
      cur.rowIds.push(row.id);
    }

    const conclusionNode = makeTrieNode(
      cur.id,
      row.conclusion.type === 'terminal' ? 'terminal' : 'continue',
      {
        outputs:
          row.conclusion.type === 'terminal'
            ? row.conclusion.outputs
            : undefined,
        targetTableId:
          row.conclusion.type === 'continue'
            ? row.conclusion.tableId
            : undefined,
        rowIds: [row.id],
      },
    );
    cur.children.set(`conclusion|${row.id}`, conclusionNode);
  }

  return root;
}

function attachCoverageGaps(root: TrieNode, gaps: CoverageGap[]): void {
  for (const gap of gaps) {
    let cur = root;
    for (const step of gap.branchPath) {
      const key = cellKey(step.colId, step.cell);
      let next = cur.children.get(key);
      if (!next) {
        next = makeTrieNode(cur.id, 'phantomCondition', {
          colId: step.colId,
          cell: step.cell,
        });
        cur.children.set(key, next);
      }
      cur = next;
    }
    const missingCell: Cell = { op: '=', val: gap.missingCol.missingVal };
    const missingKey = cellKey(gap.missingCol.colId, missingCell);
    let missingNode = cur.children.get(missingKey);
    if (!missingNode) {
      missingNode = makeTrieNode(cur.id, 'phantomCondition', {
        colId: gap.missingCol.colId,
        cell: missingCell,
      });
      cur.children.set(missingKey, missingNode);
      const deadend = makeTrieNode(missingNode.id, 'phantomDeadend');
      missingNode.children.set(`deadend|${missingNode.id}`, deadend);
    }
  }
}

// ---- Format helpers ----

export function formatCellLabel(cell: Cell, t: TranslationSet): string {
  if (cell.op === 'null') return t.flowchartEmpty;
  if (cell.op === 'before_today')
    return t.operatorLabels.before_today ?? 'before_today';
  if (cell.op === 'today_or_before')
    return t.operatorLabels.today_or_before ?? 'today_or_before';
  if (cell.op === 'after_today')
    return t.operatorLabels.after_today ?? 'after_today';
  if (cell.op === 'today_or_after')
    return t.operatorLabels.today_or_after ?? 'today_or_after';
  if (
    cell.op === 'between' &&
    Array.isArray(cell.val) &&
    cell.val.length === 2
  ) {
    return `${cell.val[0]} ～ ${cell.val[1]}`;
  }
  const opStr: Record<string, string> = {
    '=': '=',
    '!=': '≠',
    '<': '<',
    '<=': '≤',
    '>': '>',
    '>=': '≥',
    contains: t.flowchartOpContains,
    starts_with: t.flowchartOpStartsWith,
    ends_with: t.flowchartOpEndsWith,
    in: 'in',
  };
  const op = opStr[cell.op] ?? cell.op;
  if (Array.isArray(cell.val)) return `${op} [${cell.val.join(', ')}]`;
  return `${op} ${cell.val ?? ''}`.trim();
}

// ---- Collect all trie nodes (DFS) ----

function collectAll(node: TrieNode, result: TrieNode[] = []): TrieNode[] {
  result.push(node);
  for (const child of node.children.values()) collectAll(child, result);
  return result;
}

// ---- Dagre layout ----

const NODE_W: Record<TrieNode['nodeType'], number> = {
  root: 100,
  condition: 160,
  terminal: 180,
  continue: 180,
  phantomCondition: 160,
  phantomDeadend: 160,
};
const NODE_H: Record<TrieNode['nodeType'], number> = {
  root: 40,
  condition: 60,
  terminal: 56,
  continue: 44,
  phantomCondition: 60,
  phantomDeadend: 44,
};

function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 50 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) {
    g.setNode(n.id, {
      width: n.data._w as number,
      height: n.data._h as number,
    });
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }
  dagre.layout(g);
  return nodes.map((n) => {
    const { x, y } = g.node(n.id);
    const w = n.data._w as number;
    const h = n.data._h as number;
    return { ...n, position: { x: x - w / 2, y: y - h / 2 } };
  });
}

// ---- Public API ----

export interface FlowChartData {
  nodes: Node[];
  edges: Edge[];
}

export function buildFlowChart(
  table: Table,
  logic: Logic,
  t: TranslationSet,
  gaps: CoverageGap[] = [],
): FlowChartData {
  const root = buildTrie(table);
  if (gaps.length > 0) attachCoverageGaps(root, gaps);
  const allNodes = collectAll(root);

  const rfNodes: Node[] = allNodes.map((tn) => {
    const nt = tn.nodeType;
    const w = NODE_W[nt];
    const h = NODE_H[nt];

    let label = '';
    let fieldName: string | undefined;

    if (nt === 'root') {
      label = t.flowchartStart;
    } else if (nt === 'condition' || nt === 'phantomCondition') {
      const col = table.cols.find((c) => c.id === tn.colId);
      fieldName = col?.fieldId
        ? (logic.fieldDefs[col.fieldId]?.name ?? '?')
        : '?';
      label = tn.cell ? formatCellLabel(tn.cell, t) : '';
    } else if (nt === 'terminal') {
      const parts = table.outputCols.map((oc) => {
        const val = tn.outputs?.[oc.id] ?? '';
        return `${oc.name}: ${val}`;
      });
      label = parts.length > 0 ? parts.join('\n') : t.flowchartNoOutput;
    } else if (nt === 'continue') {
      const name = tn.targetTableId
        ? (logic.tables[tn.targetTableId]?.name ?? '?')
        : '?';
      label = `→ ${name}`;
    } else if (nt === 'phantomDeadend') {
      label = t.flowchartDeadendLabel;
    }

    return {
      id: tn.id,
      type: `${nt}Node`,
      position: { x: 0, y: 0 },
      data: {
        label,
        fieldName,
        rowIds: tn.rowIds,
        targetTableId: tn.targetTableId,
        _w: w,
        _h: h,
      },
    };
  });

  const rfEdges: Edge[] = [];
  for (const tn of allNodes) {
    for (const child of tn.children.values()) {
      const isPhantomEdge =
        child.nodeType === 'phantomCondition' ||
        child.nodeType === 'phantomDeadend';
      rfEdges.push({
        id: `e-${tn.id}-${child.id}`,
        source: tn.id,
        target: child.id,
        style: {
          stroke: isPhantomEdge ? '#eab308' : '#9ca3af',
          strokeDasharray: isPhantomEdge ? '4 4' : undefined,
        },
        markerEnd: {
          type: 'arrowclosed' as const,
          color: isPhantomEdge ? '#eab308' : '#9ca3af',
        },
      });
    }
  }

  return { nodes: layoutNodes(rfNodes, rfEdges), edges: rfEdges };
}
