// ============================================================
// SearchBar.tsx
// ============================================================
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, TrendingUp, TrendingDown, X } from 'lucide-react';
import { useStockStore } from '@/store/stockStore';
import { formatPrice, formatPercent, getChangeColor } from '@/lib/format';

interface Props {
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchBar({ placeholder, autoFocus }: Props) {
  const router = useRouter();
  const { search, searchResults, isSearching, clearSearch } = useStockStore();
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) { search(query); setShowDropdown(true); }
      else { clearSearch(); setShowDropdown(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (symbol: string) => {
    setQuery('');
    setShowDropdown(false);
    clearSearch();
    router.push(`/stocks/${symbol}`);
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        {isSearching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" />}
        {query && !isSearching && (
          <button onClick={() => { setQuery(''); clearSearch(); setShowDropdown(false); }}
            className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-slate-500 hover:text-white" />
          </button>
        )}
        <input ref={inputRef} type="text" value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setShowDropdown(true)}
          placeholder={placeholder || '搜索股票...'}
          autoFocus={autoFocus}
          className="input-field pl-10 pr-10 h-11"
        />
      </div>

      {showDropdown && searchResults.length > 0 && (
        <div ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1.5 bg-[#131c2e] border border-[#1e2d4a] rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          {searchResults.map((stock: any) => {
            const isUp = parseFloat(stock.change_pct || 0) >= 0;
            return (
              <button key={stock.symbol} onClick={() => handleSelect(stock.symbol)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                  {stock.symbol?.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">{stock.symbol}</span>
                    <span className="text-xs text-slate-500 truncate">{stock.name_zh || stock.name_en}</span>
                  </div>
                  <div className="text-xs text-slate-600">{stock.exchange} · {stock.sector}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  {stock.price && (
                    <>
                      <div className="text-sm font-mono text-white">${formatPrice(stock.price)}</div>
                      <div className={`text-xs font-mono ${isUp ? 'price-up' : 'price-down'}`}>
                        {formatPercent(stock.change_pct)}
                      </div>
                    </>
                  )}
                </div>
              </button>
            );
          })}
          <div className="border-t border-[#1e2d4a] px-4 py-2 text-center">
            <button onClick={() => router.push(`/search?q=${encodeURIComponent(query)}`)}
              className="text-xs text-blue-400 hover:text-blue-300">
              查看全部结果 →
            </button>
          </div>
        </div>
      )}

      {showDropdown && query && searchResults.length === 0 && !isSearching && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#131c2e] border border-[#1e2d4a] rounded-xl shadow-2xl z-50 px-4 py-6 text-center text-sm text-slate-500 animate-fade-in">
          未找到「{query}」相关股票
        </div>
      )}
    </div>
  );
}

// ============================================================
// MarketOverview.tsx - 主要指数展示
// ============================================================
export function MarketOverview({ loading }: { loading: boolean }) {
  const indices = [
    { name: '道琼斯', symbol: 'DJI', value: '39,808.51', change: '+254.68', pct: '+0.64%', up: true },
    { name: '纳斯达克', symbol: 'IXIC', value: '16,403.51', change: '+48.26', pct: '+0.30%', up: true },
    { name: 'S&P 500', symbol: 'SPX', value: '5,248.49', change: '+18.32', pct: '+0.35%', up: true },
    { name: '上证指数', symbol: 'SHCOMP', value: '3,048.42', change: '-12.50', pct: '-0.41%', up: false },
    { name: '恒生指数', symbol: 'HSI', value: '17,284.54', change: '+124.38', pct: '+0.72%', up: true },
    { name: '日经225', symbol: 'NI225', value: '39,523.55', change: '+214.09', pct: '+0.54%', up: true },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {indices.map((idx) => (
        <div key={idx.symbol} className="card p-4">
          {loading ? (
            <div className="space-y-2">
              <div className="skeleton h-3 w-16 rounded" />
              <div className="skeleton h-5 w-24 rounded" />
              <div className="skeleton h-3 w-12 rounded" />
            </div>
          ) : (
            <>
              <div className="text-xs text-slate-500 mb-1">{idx.name}</div>
              <div className="text-base font-bold font-mono text-white">{idx.value}</div>
              <div className={`text-xs font-mono mt-0.5 ${idx.up ? 'price-up' : 'price-down'}`}>
                {idx.change} ({idx.pct})
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// TopMovers.tsx - 涨跌榜
// ============================================================
export function TopMovers({ loading }: { loading: boolean }) {
  const gainers = [
    { symbol: 'NVDA', name: '英伟达', change_pct: 4.21, price: 875.39 },
    { symbol: 'TSLA', name: '特斯拉', change_pct: 4.38, price: 202.64 },
    { symbol: 'AMD', name: 'AMD', change_pct: 5.10, price: 168.32 },
    { symbol: 'META', name: 'Meta', change_pct: 2.43, price: 519.83 },
    { symbol: 'AMZN', name: '亚马逊', change_pct: 2.81, price: 186.40 },
  ];
  const losers = [
    { symbol: 'UNH', name: '联合健康', change_pct: -2.30, price: 489.21 },
    { symbol: 'JPM', name: '摩根大通', change_pct: -1.45, price: 197.80 },
    { symbol: 'NFLX', name: 'Netflix', change_pct: -3.20, price: 608.42 },
    { symbol: 'MSFT', name: '微软', change_pct: -0.76, price: 415.50 },
    { symbol: 'AAPL', name: '苹果', change_pct: -0.63, price: 189.30 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[
        { title: '涨幅榜', data: gainers, isUp: true },
        { title: '跌幅榜', data: losers, isUp: false },
      ].map(({ title, data, isUp }) => (
        <div key={title} className="card">
          <div className="p-4 border-b border-[#1e2d4a] flex items-center gap-2">
            {isUp ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
            <span className="font-semibold text-white text-sm">{title}</span>
          </div>
          <div className="divide-y divide-[#1e2d4a]/50">
            {loading ? Array(5).fill(null).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <div className="skeleton h-3 w-12 rounded" />
                <div className="skeleton h-3 w-20 rounded ml-auto" />
                <div className="skeleton h-5 w-14 rounded" />
              </div>
            )) : data.map((stock) => (
              <div key={stock.symbol} className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/3 transition-colors">
                <div>
                  <div className="text-sm font-semibold text-white">{stock.symbol}</div>
                  <div className="text-xs text-slate-500">{stock.name}</div>
                </div>
                <span className="ml-auto text-sm font-mono text-slate-300">${formatPrice(stock.price)}</span>
                <span className={`badge ${isUp ? 'badge-green' : 'badge-red'} font-mono min-w-[60px] justify-center`}>
                  {isUp ? '+' : ''}{Math.abs(stock.change_pct).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// NewsCard.tsx
// ============================================================
export function NewsCard({ news, compact = false }: { news: any; compact?: boolean }) {
  const sentimentColor = news.sentiment === 'positive' ? 'badge-green' : news.sentiment === 'negative' ? 'badge-red' : 'badge-blue';
  const sentimentLabel = news.sentiment === 'positive' ? '利好' : news.sentiment === 'negative' ? '利空' : '中性';

  if (compact) {
    return (
      <a href={news.source_url || '#'} target="_blank" rel="noopener noreferrer"
        className="flex items-start gap-3 py-2 hover:bg-white/3 rounded-lg px-2 -mx-2 transition-colors group">
        <div className={`w-1 rounded-full h-full min-h-[40px] flex-shrink-0 ${news.sentiment === 'positive' ? 'bg-emerald-500' : news.sentiment === 'negative' ? 'bg-red-500' : 'bg-slate-600'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-200 group-hover:text-white line-clamp-2 leading-snug">{news.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-600">{news.source}</span>
            <span className="text-xs text-slate-700">·</span>
            <span className="text-xs text-slate-600">{news.published_at ? new Date(news.published_at).toLocaleDateString('zh-CN') : ''}</span>
          </div>
        </div>
      </a>
    );
  }

  return (
    <a href={news.source_url || '#'} target="_blank" rel="noopener noreferrer"
      className="card-hover p-4 block group">
      {news.image_url && (
        <div className="w-full h-36 rounded-lg bg-[#0d1525] mb-3 overflow-hidden">
          <img src={news.image_url} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}
      <h3 className="text-sm font-medium text-slate-200 group-hover:text-white line-clamp-2 mb-2 leading-snug">{news.title}</h3>
      {news.summary && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{news.summary}</p>}
      <div className="flex items-center gap-2">
        <span className={`badge ${sentimentColor}`}>{sentimentLabel}</span>
        <span className="text-xs text-slate-600">{news.source}</span>
        <span className="ml-auto text-xs text-slate-700">{news.published_at ? new Date(news.published_at).toLocaleDateString('zh-CN') : ''}</span>
      </div>
    </a>
  );
}

// ============================================================
// ReportDownload.tsx - 报告下载弹窗
// ============================================================
export function ReportDownload({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [format, setFormat] = useState<'md' | 'xlsx' | 'pptx'>('pptx');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { api: apiClient } = { api: require('@/lib/api').api };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post('/reports/generate', { symbol, format }, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${symbol}_report.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formats = [
    { key: 'pptx', label: 'PowerPoint', desc: '精美PPT报告', icon: '📊' },
    { key: 'xlsx', label: 'Excel', desc: '数据分析表格', icon: '📈' },
    { key: 'md', label: 'Markdown', desc: '文字分析报告', icon: '📝' },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-[#131c2e] border border-[#1e2d4a] rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-1">下载分析报告</h2>
        <p className="text-sm text-slate-500 mb-5">{symbol} · 选择报告格式</p>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {formats.map(({ key, label, desc, icon }) => (
            <button key={key} onClick={() => setFormat(key)}
              className={`p-3 rounded-xl border-2 text-center transition-all ${format === key ? 'border-blue-500 bg-blue-500/10' : 'border-[#1e2d4a] hover:border-[#253450]'}`}>
              <div className="text-2xl mb-1">{icon}</div>
              <div className="text-sm font-semibold text-white">{label}</div>
              <div className="text-xs text-slate-500">{desc}</div>
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button onClick={handleGenerate} disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? '生成中...' : done ? '✅ 已下载' : '生成下载'}
          </button>
        </div>
      </div>
    </div>
  );
}
