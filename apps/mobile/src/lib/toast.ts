import { create } from 'zustand';

type ToastState = { message: string | null; seq: number };

export const useToastStore = create<ToastState>(() => ({ message: null, seq: 0 }));

let timer: ReturnType<typeof setTimeout> | undefined;

/** Show a short confirmation or error at the bottom of the screen. */
export function toast(message: string, ms = 2600): void {
  if (timer) clearTimeout(timer);
  useToastStore.setState((s) => ({ message, seq: s.seq + 1 }));
  timer = setTimeout(() => useToastStore.setState({ message: null }), ms);
}
