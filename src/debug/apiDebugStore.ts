import { ApiDebugEvent } from "../types/analytics";

type DebugState = {
  enabled: boolean;
  expanded: boolean;
  events: ApiDebugEvent[];
};

type Listener = () => void;

const state: DebugState = {
  enabled: true,
  expanded: false,
  events: []
};

const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function getApiDebugState(): DebugState {
  return {
    enabled: state.enabled,
    expanded: state.expanded,
    events: [...state.events]
  };
}

export function subscribeApiDebug(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setApiDebugEnabled(enabled: boolean): void {
  state.enabled = enabled;
  notify();
}

export function setApiDebugExpanded(expanded: boolean): void {
  state.expanded = expanded;
  notify();
}

export function clearApiDebugEvents(): void {
  state.events = [];
  notify();
}

export function pushApiDebugEvent(event: ApiDebugEvent): void {
  if (!state.enabled) {
    return;
  }
  state.events = [event, ...state.events].slice(0, 200);
  notify();
}
