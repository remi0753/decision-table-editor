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
  condition: 40,
  terminal: 56,
  continue: 44,
  phantomCondition: 40,
  phantomDeadend: 44,
};

const RANK_SEP = 70;
const SWIMLANE_HEADER_H = 28;
const SWIMLANE_HEADER_GAP = 28;

function layoutNodes(
  nodes: Node[],
  edges: Edge[],
  colRankByNodeId: Map<string, number>,
  swimlaneLabels: Map<number, string>,
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 30, ranksep: RANK_SEP });
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

  // Place each column rank at a deterministic x derived from the decision
  // table's column order, not from dagre's tree depth. This keeps columns
  // aligned even when a row's path skips earlier columns (e.g. a row that
  // only sets c4/c5 would otherwise land at dagre rank 1, aligning with
  // c1 rather than with c4).
  const widthByRank = new Map<number, number>();
  let maxRank = 0;
  for (const n of nodes) {
    const rank = colRankByNodeId.get(n.id);
    if (rank === undefined) continue;
    if (rank > maxRank) maxRank = rank;
    const w = n.data._w as number;
    const cur = widthByRank.get(rank) ?? 0;
    if (w > cur) widthByRank.set(rank, w);
  }
  const xByRank = new Map<number, number>();
  let cursor = 0;
  for (let r = 0; r <= maxRank; r++) {
    const w = widthByRank.get(r) ?? 0;
    cursor += w / 2;
    xByRank.set(r, cursor);
    cursor += w / 2 + RANK_SEP;
  }

  const positioned = nodes.map((n) => {
    const { x: dagreX, y } = g.node(n.id);
    const rank = colRankByNodeId.get(n.id);
    const x = rank !== undefined ? (xByRank.get(rank) ?? dagreX) : dagreX;
    const w = n.data._w as number;
    const h = n.data._h as number;
    return { ...n, position: { x: x - w / 2, y: y - h / 2 } };
  });

  // Append swimlane header nodes above every column that has a label.
  // They share a single y so the headers form a row across the chart,
  // and inherit each column rank's max-width so a header always covers
  // the nodes beneath it.
  let minY = Infinity;
  for (const n of positioned) {
    if (n.position.y < minY) minY = n.position.y;
  }
  if (!Number.isFinite(minY)) minY = 0;
  const headerY = minY - SWIMLANE_HEADER_H - SWIMLANE_HEADER_GAP;

  const headerNodes: Node[] = [];
  for (const [rank, label] of swimlaneLabels) {
    const w = widthByRank.get(rank);
    const cx = xByRank.get(rank);
    if (w === undefined || cx === undefined) continue;
    headerNodes.push({
      id: `swimlane-${rank}`,
      type: 'swimlaneHeaderNode',
      position: { x: cx - w / 2, y: headerY },
      data: {
        label,
        rowIds: [],
        _w: w,
        _h: SWIMLANE_HEADER_H,
      },
      draggable: false,
      selectable: false,
    });
  }

  return [...headerNodes, ...positioned];
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

  // Map each column id to its display order, used to align flow-chart ranks
  // with the decision-table column order (left→right).
  const colIndex = new Map<string, number>();
  table.cols.forEach((c, i) => {
    colIndex.set(c.id, i);
  });
  const conclusionRank = table.cols.length + 1;

  const colRankByNodeId = new Map<string, number>();
  for (const tn of allNodes) {
    if (tn.nodeType === 'root') {
      colRankByNodeId.set(tn.id, 0);
    } else if (
      tn.nodeType === 'condition' ||
      tn.nodeType === 'phantomCondition'
    ) {
      const idx = tn.colId !== undefined ? colIndex.get(tn.colId) : undefined;
      if (idx !== undefined) colRankByNodeId.set(tn.id, idx + 1);
    } else if (
      tn.nodeType === 'terminal' ||
      tn.nodeType === 'continue' ||
      tn.nodeType === 'phantomDeadend'
    ) {
      colRankByNodeId.set(tn.id, conclusionRank);
    }
  }

  // Swimlane label per column rank — the field name shown above every
  // node in that column, replacing the per-node fieldName header.
  const swimlaneLabels = new Map<number, string>();
  table.cols.forEach((c, i) => {
    const name = c.fieldId ? (logic.fieldDefs[c.fieldId]?.name ?? '?') : '?';
    swimlaneLabels.set(i + 1, name);
  });

  const rfNodes: Node[] = allNodes.map((tn) => {
    const nt = tn.nodeType;
    const w = NODE_W[nt];
    const h = NODE_H[nt];

    let label = '';

    if (nt === 'root') {
      label = t.flowchartStart;
    } else if (nt === 'condition' || nt === 'phantomCondition') {
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

  return {
    nodes: layoutNodes(rfNodes, rfEdges, colRankByNodeId, swimlaneLabels),
    edges: rfEdges,
  };
}
