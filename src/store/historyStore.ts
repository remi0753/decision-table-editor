import { create } from 'zustand';
import type { Logic } from '@/types/logic';
import { useLogicStore } from './logicStore';

const MAX_HISTORY = 100;

interface HistoryState {
  past: Logic[];
  future: Logic[];
}

export const useHistoryStore = create<HistoryState>(() => ({
  past: [],
  future: [],
}));

let isApplyingHistory = false;

useLogicStore.subscribe((state, prevState) => {
  if (state.logic === prevState.logic) return;
  if (isApplyingHistory) return;
  useHistoryStore.setState((s) => ({
    past: [...s.past, prevState.logic].slice(-MAX_HISTORY),
    future: [],
  }));
});

export function clearHistory() {
  useHistoryStore.setState({ past: [], future: [] });
}

export function undo() {
  const { past, future } = useHistoryStore.getState();
  if (past.length === 0) return;
  const prev = past[past.length - 1]!;
  const current = useLogicStore.getState().logic;
  isApplyingHistory = true;
  try {
    useLogicStore.setState({ logic: prev });
  } finally {
    isApplyingHistory = false;
  }
  useHistoryStore.setState({
    past: past.slice(0, -1),
    future: [current, ...future].slice(0, MAX_HISTORY),
  });
}

export function redo() {
  const { past, future } = useHistoryStore.getState();
  if (future.length === 0) return;
  const next = future[0]!;
  const current = useLogicStore.getState().logic;
  isApplyingHistory = true;
  try {
    useLogicStore.setState({ logic: next });
  } finally {
    isApplyingHistory = false;
  }
  useHistoryStore.setState({
    past: [...past, current].slice(-MAX_HISTORY),
    future: future.slice(1),
  });
}
