import { create } from 'zustand';

export type Modal = null | 'settings';
export type MainView = 'viewer' | 'grid';

export interface Toast {
  id: number;
  kind: 'info' | 'error' | 'success';
  text: string;
}

interface UIState {
  view: MainView;
  sideOpen: boolean; // controls sheet (single layout)
  modal: Modal;
  toasts: Toast[];
  setView: (v: MainView) => void;
  setSideOpen: (v: boolean) => void;
  openModal: (m: Modal) => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  dismiss: (id: number) => void;
}

let tid = 1;

export const useUI = create<UIState>((set, get) => ({
  view: 'viewer',
  sideOpen: false,
  modal: null,
  toasts: [],
  setView: (view) => set({ view }),
  setSideOpen: (sideOpen) => set({ sideOpen }),
  openModal: (modal) => set({ modal }),
  toast: (text, kind = 'info') => {
    const id = tid++;
    set({ toasts: [...get().toasts, { id, kind, text }].slice(-4) });
    setTimeout(() => get().dismiss(id), kind === 'error' ? 6000 : 3000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (text: string, kind?: Toast['kind']) => useUI.getState().toast(text, kind);
