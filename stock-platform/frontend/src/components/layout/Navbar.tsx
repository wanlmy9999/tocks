'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Bell, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { useStockStore } from '@/store/stockStore';
import { formatPercent } from '@/lib/format';

const MOCK_INDICES = [
  { name: '道指', changePct: 0.34 },
  { name: '纳指', changePct: 0.82 },
  { name: '标普', changePct: 0.51 },
];

export function Navbar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { fetchMarketData } = useStockStore();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMarketData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <header className="h-14 flex items-center gap-4 px-5 border-b border-[#1E2D4A] bg-[#0D1220]/80 backdrop-blur-sm flex-shrink-0">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索股票 — 中文 / 代码 / 英文"
          className="w-full h-9 pl-9 pr-4 bg-[#141B2D] border border-[#1E2D4A] rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60 transition-colors"
        />
      </form>

      {/* Market indices ticker */}
      <div className="hidden md:flex items-center gap-4">
        {MOCK_INDICES.map((idx) => (
          <div key={idx.name} className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">{idx.name}</span>
            <span className={clsx('font-mono font-medium', idx.changePct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {formatPercent(idx.changePct)}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={handleRefresh}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          title="刷新数据"
        >
          <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
        </button>
        <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all">
          <Bell className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
