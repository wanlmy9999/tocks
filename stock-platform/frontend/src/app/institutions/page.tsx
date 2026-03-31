'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Building2, TrendingUp, TrendingDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatMarketCap, formatPercent } from '@/lib/format';

export default function InstitutionsPage() {
  const [topInstitutions, setTopInstitutions] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'top' | 'ranking'>('top');

  const fetchTop = useCallback(async () => {
    try {
      const res = await api.get('/institutions/top?limit=6');
      setTopInstitutions(res.data?.data || getMockInstitutions());
    } catch {
      setTopInstitutions(getMockInstitutions());
    }
  }, []);

  const fetchRanking = useCallback(async (p: number) => {
    try {
      const res = await api.get(`/institutions/ranking?page=${p}&pageSize=20`);
      const { data: d } = res.data;
      setRanking(d?.data || getMockInstitutions(20));
      setTotalPages(d?.totalPages || 1);
      setTotal(d?.total || 0);
    } catch {
      setRanking(getMockInstitutions(20));
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchTop(), fetchRanking(1)]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRanking(page); }, [page]);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-purple-400" />
          <div>
            <h1 className="text-xl font-bold text-white">机构追踪</h1>
            <p className="text-xs text-slate-400">SEC 13F · 持仓数据 · 增减仓追踪</p>
          </div>
        </div>
      </div>

      {/* Tab */}
      <div className="flex gap-1 bg-[#131c2e] p-1 rounded-xl border border-[#1e2d4a] w-fit">
        {[
          { key: 'top', label: '热门机构' },
          { key: 'ranking', label: '机构排行' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key as any)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'top' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(loading ? Array(6).fill(null) : topInstitutions).map((inst, i) => (
            <InstitutionCard key={i} institution={inst} loading={loading} />
          ))}
        </div>
      )}

      {activeTab === 'ranking' && (
        <div className="card">
          {/* 搜索 */}
          <div className="p-4 border-b border-[#1e2d4a] flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              共 <span className="text-white font-semibold">{total}</span> 家机构
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                className="input-field pl-9"
                placeholder="搜索机构..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* 表格 */}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-12">排名</th>
                  <th>机构名称</th>
                  <th className="text-right">持仓市值</th>
                  <th className="text-right">买入市值</th>
                  <th className="text-right">卖出市值</th>
                  <th className="text-right">持仓数</th>
                  <th className="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {ranking
                  .filter((r) => !search || r.name?.toLowerCase().includes(search.toLowerCase()))
                  .map((inst, i) => (
                  <tr key={inst.id || i}>
                    <td>
                      <span className={`font-bold text-sm ${i < 3 ? 'text-amber-400' : 'text-slate-500'}`}>
                        #{inst.rank || (page - 1) * 20 + i + 1}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-400">
                          {(inst.name || '').slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{inst.name}</div>
                          <div className="text-xs text-slate-500">{inst.name_zh || inst.type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right font-mono text-sm text-white">
                      {formatMarketCap(inst.total_holdings_value)}
                    </td>
                    <td className="text-right">
                      <span className="text-emerald-400 text-sm font-mono">
                        {formatMarketCap(inst.bought_value)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="text-red-400 text-sm font-mono">
                        {formatMarketCap(inst.sold_value)}
                      </span>
                    </td>
                    <td className="text-right text-sm text-slate-300">
                      {inst.holdings_count}只
                    </td>
                    <td className="text-right">
                      <Link href={`/institutions/${inst.id}`} className="btn-ghost text-xs">
                        详情 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          <div className="p-4 border-t border-[#1e2d4a] flex items-center justify-between">
            <span className="text-sm text-slate-500">
              第 {page} / {totalPages} 页
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="btn-secondary px-3 py-1.5 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                className="btn-secondary px-3 py-1.5 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 机构卡片
// ============================================================
function InstitutionCard({ institution: inst, loading }: { institution: any; loading: boolean }) {
  if (loading || !inst) {
    return (
      <div className="card p-5 space-y-3">
        <div className="skeleton h-10 w-10 rounded-lg" />
        <div className="skeleton h-4 w-32 rounded" />
        <div className="skeleton h-3 w-48 rounded" />
        <div className="grid grid-cols-2 gap-2">
          <div className="skeleton h-12 rounded-lg" />
          <div className="skeleton h-12 rounded-lg" />
        </div>
      </div>
    );
  }

  const topHolding = inst.top_holding;
  const changes = inst.recent_changes || [];

  return (
    <Link href={`/institutions/${inst.id}`} className="card-hover p-5 block">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600/30 to-blue-600/30 border border-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-400 flex-shrink-0">
          {(inst.name || '').slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm truncate">{inst.name}</div>
          <div className="text-xs text-slate-500">{inst.name_zh || inst.type || '机构投资者'}</div>
        </div>
        <span className="badge badge-blue">{inst.holdings_count || 0}持仓</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#0d1525] rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-1">总持仓市值</div>
          <div className="text-sm font-semibold text-white">{formatMarketCap(inst.total_holdings_value)}</div>
        </div>
        <div className="bg-[#0d1525] rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-1">最新申报</div>
          <div className="text-sm font-semibold text-white">{inst.latest_quarter || inst.filing_date || 'N/A'}</div>
        </div>
      </div>

      {topHolding && (
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg px-3 py-2 mb-3">
          <div className="text-xs text-slate-500 mb-1">最大持仓</div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-blue-400">{topHolding.symbol}</span>
            <span className="text-xs text-slate-400">{formatMarketCap(topHolding.market_value)}</span>
          </div>
        </div>
      )}

      {changes.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs text-slate-500">最新变动</div>
          {changes.slice(0, 2).map((c: any, i: number) => {
            const isUp = ['buy', 'new'].includes(c.change_type);
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                {isUp ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
                <span className="text-slate-300">{c.symbol}</span>
                <span className={isUp ? 'text-emerald-400' : 'text-red-400'}>
                  {isUp ? '增仓' : '减仓'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Link>
  );
}

// ============================================================
// Mock数据（开发用）
// ============================================================
function getMockInstitutions(count = 6): any[] {
  const data = [
    { id: '1', name: 'Berkshire Hathaway Inc', name_zh: '伯克希尔·哈撒韦', type: 'Holding Company', total_holdings_value: 3.7e11, holdings_count: 47, latest_quarter: '2024Q4', top_holding: { symbol: 'AAPL', market_value: 1.74e11 }, recent_changes: [{ symbol: 'OXY', change_type: 'buy' }, { symbol: 'PARA', change_type: 'sell' }] },
    { id: '2', name: 'Vanguard Group Inc', name_zh: '先锋基金', type: 'Mutual Fund', total_holdings_value: 3.5e12, holdings_count: 3823, latest_quarter: '2024Q4', top_holding: { symbol: 'AAPL', market_value: 3.2e11 }, recent_changes: [{ symbol: 'NVDA', change_type: 'buy' }, { symbol: 'META', change_type: 'buy' }] },
    { id: '3', name: 'BlackRock Inc', name_zh: '贝莱德', type: 'Asset Manager', total_holdings_value: 2.9e12, holdings_count: 2987, latest_quarter: '2024Q4', top_holding: { symbol: 'AAPL', market_value: 2.8e11 }, recent_changes: [{ symbol: 'TSLA', change_type: 'sell' }, { symbol: 'AMZN', change_type: 'buy' }] },
    { id: '4', name: 'Bridgewater Associates', name_zh: '桥水基金', type: 'Hedge Fund', total_holdings_value: 1.8e11, holdings_count: 281, latest_quarter: '2024Q4', top_holding: { symbol: 'SPY', market_value: 1.2e10 }, recent_changes: [{ symbol: 'GLD', change_type: 'new' }] },
    { id: '5', name: 'Renaissance Technologies', name_zh: '文艺复兴科技', type: 'Hedge Fund', total_holdings_value: 8e10, holdings_count: 3500, latest_quarter: '2024Q3', top_holding: { symbol: 'NVDA', market_value: 2e9 }, recent_changes: [{ symbol: 'NVDA', change_type: 'buy' }] },
    { id: '6', name: 'Soros Fund Management', name_zh: '索罗斯基金', type: 'Hedge Fund', total_holdings_value: 1.9e10, holdings_count: 82, latest_quarter: '2024Q4', top_holding: { symbol: 'NVS', market_value: 3.5e8 }, recent_changes: [{ symbol: 'GOOGL', change_type: 'new' }] },
  ];
  return data.slice(0, count);
}
