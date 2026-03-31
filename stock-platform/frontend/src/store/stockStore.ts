import { create } from 'zustand';
import { api } from '@/lib/api';

interface StockStore {
  searchResults: any[];
  marketData: any[];
  isSearching: boolean;
  searchQuery: string;
  search: (query: string) => Promise<void>;
  fetchMarketData: () => Promise<void>;
  clearSearch: () => void;
}

export const useStockStore = create<StockStore>((set) => ({
  searchResults: [],
  marketData: [],
  isSearching: false,
  searchQuery: '',
  search: async (query: string) => {
    if (!query.trim()) { set({ searchResults: [], searchQuery: '' }); return; }
    set({ isSearching: true, searchQuery: query });
    try {
      const res = await api.get('/stocks/search?q=' + encodeURIComponent(query) + '&limit=10');
      set({ searchResults: res.data?.data || [] });
    } catch { set({ searchResults: [] }); }
    finally { set({ isSearching: false }); }
  },
  fetchMarketData: async () => {
    try {
      const res = await api.get('/heatmap');
      set({ marketData: res.data?.data || [] });
    } catch { set({ marketData: [] }); }
  },
  clearSearch: () => set({ searchResults: [], searchQuery: '' }),
}));
