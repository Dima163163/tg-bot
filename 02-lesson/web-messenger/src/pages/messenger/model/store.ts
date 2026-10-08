import { create } from 'zustand';

interface MessengerStore {
  newMessagesCount: number;
  search: string;
  selectedClientId: number | null;
  addNewMessages: (count: number) => void;
  clearNewMessages: () => void;
  selectClient: (clientId: number) => void;
  setSearch: (search: string) => void;
}

export const useMessengerStore = create<MessengerStore>((set) => ({
  newMessagesCount: 0,
  search: '',
  selectedClientId: null,
  addNewMessages: (count) => set((state) => ({ newMessagesCount: state.newMessagesCount + count })),
  clearNewMessages: () => set({ newMessagesCount: 0 }),
  selectClient: (selectedClientId) => set({ selectedClientId }),
  setSearch: (search) => set({ search }),
}));
