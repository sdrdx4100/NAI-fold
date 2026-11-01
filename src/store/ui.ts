import { create } from 'zustand';

export type MainMode = 'story' | 'image';
export type SideTab = 'story' | 'lore' | 'gen' | 'context' | 'image' | 'library';
export type Modal = null | 'settings' | 'about' | 'storyMeta';

export interface Toast {
  id: number;
  kind: 'info' | 'error' | 'success';
  text: string;
}

interface UIState {
  mode: MainMode;
  sideTab: SideTab;
  libraryOpen: boolean; // drawer (single/dual)
  sideOpen: boolean; // sheet (single)
  modal: Modal;
  toasts: Toast[];
  loreSelected: string | null;
  setMode: (m: MainMode) => void;
  setSideTab: (t: SideTab) => void;
  setLibraryOpen: (v: boolean) => void;
  setSideOpen: (v: boolean) => void;
  openModal: (m: Modal) => void;
  setLoreSelected: (id: string | null) => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  dismiss: (id: number) => void;
}

let tid = 1;

export const useUI = create<UIState>((set, get) => ({
  mode: 'story',
  sideTab: 'story',
  libraryOpen: false,
  sideOpen: false,
  modal: null,
  toasts: [],
  loreSelected: null,
  setMode: (mode) => set({ mode }),
  setSideTab: (sideTab) => set({ sideTab }),
  setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
  setSideOpen: (sideOpen) => set({ sideOpen }),
  openModal: (modal) => set({ modal }),
  setLoreSelected: (loreSelected) => set({ loreSelected }),
  toast: (text, kind = 'info') => {
    const id = tid++;
    set({ toasts: [...get().toasts, { id, kind, text }].slice(-4) });
    setTimeout(() => get().dismiss(id), kind === 'error' ? 6000 : 3000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (text: string, kind?: Toast['kind']) => useUI.getState().toast(text, kind);
