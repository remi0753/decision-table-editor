import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow, Background, Controls, Handle, Position, useReactFlow, type Node, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { type Logic } from '@/types/logic';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

function isReachable(tableId: string, logic: Logic): boolean {
  if (logic.entryTableId === tableId) return true;
  for (const table of Object.values(logic.tables)) {
    for (const row of table.rows) {
      if (row.conclusion.type === 'continue' && row.conclusion.tableId === tableId) return true;
    }
  }
  return false;
}

function getLayoutedElements(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach(n => g.setNode(n.id, { width: 160, height: 48 }));
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map(n => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - 80, y: pos.y - 24 } };
  });
}

interface TableNodeProps {
  data: { label: string; isEntry: boolean; isOrphan: boolean; isSelected: boolean };
}

function TableNode({ data }: TableNodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div className={cn(
        'px-3 py-2 rounded border-2 text-sm font-medium cursor-pointer select-none w-40 text-center',
        data.isEntry ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-300 bg-white text-gray-700',
        data.isOrphan ? 'opacity-50' : '',
        data.isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : '',
      )}>
        {data.isEntry && <span className="text-xs mr-1">▶</span>}
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

const nodeTypes = { tableNode: TableNode };

function FitViewWatcher({ nodeCount }: { nodeCount: number }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const id = setTimeout(() => fitView({ padding: 0.15, duration: 200 }), 50);
    return () => clearTimeout(id);
  }, [nodeCount, fitView]);
  return null;
}

export function DagGraph() {
  const logic = useLogicStore(s => s.logic);
  const selectedTableId = useUiStore(s => s.selectedTableId);
  const setSelectedTable = useUiStore(s => s.setSelectedTable);

  const { nodes: rawNodes, edges } = useMemo(() => {
    const ns: Node[] = Object.values(logic.tables).map(table => ({
      id: table.id,
      type: 'tableNode',
      position: { x: 0, y: 0 },
      data: {
        label: table.name,
        isEntry: table.id === logic.entryTableId,
        isOrphan: !isReachable(table.id, logic),
        isSelected: table.id === selectedTableId,
      },
    }));

    const es: Edge[] = [];
    const edgeSet = new Set<string>();
    for (const table of Object.values(logic.tables)) {
      for (const row of table.rows) {
        if (row.conclusion.type === 'continue') {
          const key = `${table.id}->${row.conclusion.tableId}`;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            es.push({
              id: `${table.id}-${row.id}-${row.conclusion.tableId}`,
              source: table.id,
              target: row.conclusion.tableId,
              animated: false,
              style: { stroke: '#6366f1' },
            });
          }
        }
      }
    }
    return { nodes: ns, edges: es };
  }, [logic, selectedTableId]);

  const layoutedNodes = useMemo(() => getLayoutedElements(rawNodes, edges), [rawNodes, edges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedTable(node.id);
  }, [setSelectedTable]);

  return (
    <div style={{ height: 220 }} className="border-b">
      <ReactFlow
        nodes={layoutedNodes}
        edges={edges}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <FitViewWatcher nodeCount={layoutedNodes.length} />
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
