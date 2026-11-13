// Success toasts (D-63; QA item 22). One toast at a time near the top of the screen: a new one replaces the
// current one. Success messages only; errors keep their inline messages and alerts. The text comes from
// en.json's `toast` section and never holds a photo or caption (rules 9 and 10). ToastHost shows it.
import { create } from 'zustand';

import type en from '@/i18n/en.json';

/** A key in en.json's `toast` section. */
export type ToastKey = keyof (typeof en)['toast'];
/** Values for the messages' {{placeholders}}, already translated (a slot's "#morning", a username). */
export type ToastParams = { slot?: string; username?: string };

export type CurrentToast = { id: number; key: ToastKey; params?: ToastParams };

type ToastState = {
  current: CurrentToast | null;
  /** Clears the toast with this id; a toast that already replaced it stays. */
  hide: (id: number) => void;
};

/** How long a toast stays before it leaves on its own. */
export const TOAST_DURATION_MS = 2500;

let nextId = 1;

export const useToastStore = create<ToastState>()((set) => ({
  current: null,
  hide: (id) => set((state) => (state.current?.id === id ? { current: null } : state)),
}));

/** Shows a success toast, replacing any toast on screen. */
export function showToast(key: ToastKey, params?: ToastParams): void {
  useToastStore.setState({ current: { id: nextId++, key, ...(params ? { params } : {}) } });
}
