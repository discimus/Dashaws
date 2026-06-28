import { create } from 'zustand';

interface ToastState {
  message: string;
  visible: boolean;
  show: (msg: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: '',
  visible: false,
  show: (msg) => {
    set({ message: msg, visible: true });
    setTimeout(() => set({ visible: false }), 1200);
  },
}));
