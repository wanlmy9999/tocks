'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, TrendingUp, TrendingDown, Loader2, History, Star } from 'lucide-react';
import { clsx } from 'clsx';
import { stocksApi } from '@/lib/api';
import { formatPrice, formatPercent, getChangeColor, getChangeBg } from '@/lib/format';
import { useStockStore } from '@/store/stockStore';

interface SearchResult {
  symbol: string;
  name_en: string;
  name_zh: string;
  exchange: string;
  sector: string;
  price: number;
  change_pct: number;
  score: number;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams?.get('q') || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { watchlist, addToWatchlist, removeFromWatchlist } = useStockStore();

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    setSearched(true);
    try {
      const res = await stocksApi.search(q.trim(), 20);
      setResults(res?.data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = searchParams?.get('q') || '';
    if (q) { setQuery(q); doSearch(q); }
  }, [searchParams, doSearch]);

  // Debounce
  useEffect(() => {
    if (!query) { setResults([]); setSearched(false); return; }
    const t = setTimeout(() => doSearch(query), 400);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  const hotStocks = ['NVDA', 'AAPL', 'TSLA', 'META', 'AMZN', 'GOOGL', 'MSFT'];

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">股票搜索</h1>
        <p className="text-slate-500 text-sm">支持中文名称 · 英文名称 · 股票代码</p>
      </div>

      {/* Search input */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch(query)}
          placeholder="输入股票名称或代码，例如：英伟达 / NVIDIA / NVDA"
          className="w-full h-14 pl-12 pr-12 bg-[#141B2D] border border-[#2A3C5E] rounded-xl text-white text-base placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
          autoFocus
        />
      </div>

      {/* Hot picks */}
      {!searched && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-slate-400 font-medium">热门股票</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {hotStocks.map((sym) => (
              <button
                key={sym}
                onClick={() => setQuery(sym)}
                className="px-4 py-2 bg-[#141B2D] border border-[#1E2D4A] rounded-full text-sm text-slate-300 hover:border-blue-500/50 hover:text-blue-400 transition-all"
              >
                {sym}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-500 mb-3">找到 {results.length} 个结果</div>
          {results.map((stock, i) => {
            const inWatchlist = watchlist.includes(stock.symbol);
            return (
              <div
                key={stock.symbol}
                className="group flex items-center gap-4 p-4 bg-[#141B2D] border border-[#1E2D4A] rounded-xl hover:border-[#2A3C5E] transition-all cursor-pointer"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <Link href={`/stocks/${stock.symbol}`} className="flex-1 flex items-center gap-4">
                  {/* Symbol badge */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-400 font-bold text-xs font-mono">{stock.symbol.slice(0, 4)}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">{stock.symbol}</span>
                      <span className="text-[10px] text-slate-600 bg-[#0D1220] px-2 py-0.5 rounded-full">
                        {stock.exchange || 'NASDAQ'}
                      </span>
                    </div>
                    <div className="text-sm text-slate-400 truncate">
                      {stock.name_zh || stock.name_en}
                      {stock.name_zh && stock.name_en && (
                        <span className="text-slate-600 ml-2">{stock.name_en}</span>
                      )}
                    </div>
                    {stock.sector && (
                      <div className="text-xs text-slate-600 mt-0.5">{stock.sector}</div>
                    )}
                  </div>

                  {/* Price */}
                  {stock.price && (
                    <div className="text-right flex-shrink-0">
                      <div className="text-white font-mono font-medium">{formatPrice(stock.price)}</div>
                      <div className={clsx('text-sm font-mono', getChangeColor(stock.change_pct))}>
                        {formatPercent(stock.change_pct)}
                      </div>
                    </div>
                  )}
                </Link>

                {/* Watchlist */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    inWatchlist ? removeFromWatchlist(stock.symbol) : addToWatchlist(stock.symbol);
                  }}
                  className={clsx(
                    'p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100',
                    inWatchlist ? 'text-amber-400 bg-amber-400/10' : 'text-slate-500 hover:text-amber-400 hover:bg-amber-400/10'
                  )}
                >
                  <Star className={clsx('w-4 h-4', inWatchlist && 'fill-current')} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* No results */}
      {searched && !loading && results.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-[#141B2D] flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium">未找到 "{query}"</p>
          <p className="text-slate-600 text-sm mt-1">请尝试其他关键词，如股票代码或公司名称</p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
