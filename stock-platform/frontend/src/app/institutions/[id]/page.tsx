'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, TrendingUp, TrendingDown, Search, ChevronUp, ChevronDown, Loader2, PieChart, BarChart2 } from 'lucide-react';
import { clsx } from 'clsx';
import ReactECharts from 'echarts-for-react';
import { institutionsApi } from '@/lib/api';
import { formatMarketCap, formatPercent, getChangeTypeLabel, formatDate } from '@/lib/format';

type Tab = 'overview' | 'holdings' | 'changes';

export default function InstitutionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<any>(null);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('market_value');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [holdingsLoading, setHoldingsLoading] = useState(false);

  useEffect(() => {
    fetchDetail();
  }, [id]);

  useEffect(() => {
    if (tab === 'holdings') fetchHoldings();
  }, [tab, page, search, sortBy, sortDir]);

  const fetchDetail = async () => {
    try {
      const res = await institutionsApi.getDetail(id);
      setDetail(res?.data || MOCK_DETAIL);
    } catch {
      setDetail(MOCK_DETAIL);
    } finally {
      setLoading(false);
    }
  };

  const fetchHoldings = async () => {
    setHoldingsLoading(true);
    try {
      const res = await institutionsApi.getHoldings(id, page, pageSize, search, sortBy);
      setHoldings(res?.data || MOCK_HOLDINGS);
      setTotal(res?.total || MOCK_HOLDINGS.length);
      setTotalPages(res?.totalPages || 1);
    } catch {
      setHoldings(MOCK_HOLDINGS);
      setTotal(MOCK_HOLDINGS.length);
      setTotalPages(1);
    } finally {
      setHoldingsLoading(false);
    }
  };

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => (d === 'DESC' ? 'ASC' : 'DESC'));
    else { setSortBy(col); setSortDir('DESC'); }
  };

  const SortIcon = ({ col }: { col: string }) =>
    sortBy === col
      ? sortDir === 'DESC' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
      : <span className="w-3 h-3" />;

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
    </div>
  );

  const d = detail || MOCK_DETAIL;

  // ECharts pie option
  const pieOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {d}%', backgroundColor: '#0D1220', borderColor: '#2A3C5E', textStyle: { color: '#fff' } },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: '#94A3B8', fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['35%', '50%'],
      data: (d.sectorAllocation || MOCK_SECTORS).map((s: any) => ({
        name: s.sector,
        value: parseFloat(s.pct || s.total_value || 0),
      })),
      label: { show: false },
      itemStyle: { borderColor: '#0A0E1A', borderWidth: 2 },
    }],
    color: ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#84CC16'],
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[#1E2D4A] bg-[#0D1220]">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          返回机构列表
        </button>
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-7 h-7 text-purple-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{d.name_zh || d.name}</h1>
            <div className="text-slate-500 text-sm mt-0.5">{d.name}</div>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <span>CIK: {d.cik || 'N/A'}</span>
              <span>类型: {d.type || '对冲基金'}</span>
              <span>最新申报: {formatDate(d.filing_date)}</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-bold text-white font-mono">{formatMarketCap(d.aum)}</div>
            <div className="text-slate-500 text-xs mt-0.5">管理资产规模</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1E2D4A] px-6">
        {([['overview', '概览', PieChart], ['holdings', '持仓列表', BarChart2], ['changes', '增减仓', TrendingUp]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx('flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all', tab === key ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white')}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stats */}
            <div className="space-y-4">
              <div className="bg-[#141B2D] border border-[#1E2D4A] rounded-xl p-5">
                <h3 className="text-white font-semibold mb-4">机构概况</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['持仓总市值', formatMarketCap(d.total_holdings_value || d.aum)],
                    ['持仓股票数', `${d.holdings_count || d.holdingsCount || '—'} 只`],
                    ['最新季度', d.latest_quarter || d.latestQuarter || '2024Q4'],
                    ['国家/地区', d.country || 'US'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-[#0D1220] rounded-lg p-3">
                      <div className="text-slate-500 text-xs mb-1">{label}</div>
                      <div className="text-white font-semibold text-sm font-mono">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 5 holdings */}
              <div className="bg-[#141B2D] border border-[#1E2D4A] rounded-xl p-5">
                <h3 className="text-white font-semibold mb-4">前5大持仓</h3>
                <div className="space-y-2">
                  {(d.topHoldings || MOCK_TOP_HOLDINGS).slice(0, 5).map((h: any, i: number) => (
                    <div key={h.symbol} className="flex items-center gap-3">
                      <span className="text-slate-600 text-xs w-4">{i + 1}</span>
                      <div className="flex-1 flex items-center justify-between">
                        <div>
                          <span className="text-white text-sm font-mono font-medium">{h.symbol}</span>
                          <span className="text-slate-500 text-xs ml-2 truncate">{h.company_name}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-white text-sm font-mono">{formatMarketCap(h.market_value)}</div>
                          <div className="text-slate-500 text-xs">{parseFloat(h.portfolio_pct || 0).toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sector pie chart */}
            <div className="bg-[#141B2D] border border-[#1E2D4A] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">行业配置</h3>
              <ReactECharts option={pieOption} style={{ height: '300px' }} theme="dark" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(d.sectorAllocation || MOCK_SECTORS).map((s: any, i: number) => (
                  <div key={s.sector} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4'][i % 6] }} />
                    <span className="text-slate-400 truncate">{s.sector}</span>
                    <span className="text-white font-mono ml-auto">{parseFloat(s.pct || 0).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Holdings ── */}
        {tab === 'holdings' && (
          <div>
            {/* Search */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="搜索股票代码或名称..."
                  className="w-full pl-9 pr-4 h-9 bg-[#141B2D] border border-[#1E2D4A] rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <span className="text-slate-500 text-sm">共 {total} 条持仓</span>
            </div>

            {/* Table */}
            <div className="bg-[#141B2D] border border-[#1E2D4A] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full data-table">
                  <thead>
                    <tr>
                      {[['symbol', '股票'], ['company_name', '公司名称'], ['market_value', '市值'], ['portfolio_pct', '占比'], ['shares', '持股数'], ['sector', '行业'], ['change_type', '变动']].map(([col, label]) => (
                        <th key={col} className="text-left cursor-pointer hover:text-white transition-colors" onClick={() => handleSort(col)}>
                          <span className="flex items-center gap-1">{label}<SortIcon col={col} /></span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {holdingsLoading ? (
                      <tr><td colSpan={7} className="text-center py-8 text-slate-500"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
                    ) : holdings.map((h) => {
                      const ct = getChangeTypeLabel(h.change_type);
                      return (
                        <tr key={h.symbol} className="cursor-pointer" onClick={() => router.push(`/stocks/${h.symbol}`)}>
                          <td><span className="font-mono font-semibold text-blue-400">{h.symbol}</span></td>
                          <td><span className="text-slate-300 truncate max-w-[200px] block">{h.company_name}</span></td>
                          <td><span className="font-mono text-white">{formatMarketCap(h.market_value)}</span></td>
                          <td><span className="font-mono text-slate-300">{parseFloat(h.portfolio_pct || 0).toFixed(2)}%</span></td>
                          <td><span className="font-mono text-slate-400 text-xs">{(+h.shares || 0).toLocaleString()}</span></td>
                          <td><span className="text-slate-500 text-xs">{h.sector || '—'}</span></td>
                          <td><span className={clsx('text-xs font-medium', ct.color)}>{ct.icon} {ct.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <span className="text-slate-500 text-sm">第 {page} / {totalPages} 页</span>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-sm bg-[#141B2D] border border-[#1E2D4A] text-slate-400 rounded-lg disabled:opacity-40 hover:text-white transition-all">上一页</button>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-sm bg-[#141B2D] border border-[#1E2D4A] text-slate-400 rounded-lg disabled:opacity-40 hover:text-white transition-all">下一页</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Changes ── */}
        {tab === 'changes' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Increased */}
              <div className="bg-[#141B2D] border border-[#1E2D4A] rounded-xl p-5">
                <h3 className="text-emerald-400 font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> 增仓 / 新建仓
                </h3>
                <div className="space-y-3">
                  {(d.recentChanges || MOCK_CHANGES).filter((c: any) => ['buy', 'new'].includes(c.change_type)).slice(0, 8).map((c: any) => (
                    <div key={c.symbol} className="flex items-center justify-between">
                      <div>
                        <span className="text-white font-mono font-medium text-sm">{c.symbol}</span>
                        <span className="text-slate-500 text-xs ml-2">{c.company_name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-emerald-400 text-sm font-mono">+{(+c.share_change || 0).toLocaleString()}</div>
                        <div className="text-slate-500 text-xs">{getChangeTypeLabel(c.change_type).label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Decreased */}
              <div className="bg-[#141B2D] border border-[#1E2D4A] rounded-xl p-5">
                <h3 className="text-red-400 font-semibold mb-4 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" /> 减仓 / 清仓
                </h3>
                <div className="space-y-3">
                  {(d.recentChanges || MOCK_CHANGES).filter((c: any) => ['sell', 'closed'].includes(c.change_type)).slice(0, 8).map((c: any) => (
                    <div key={c.symbol} className="flex items-center justify-between">
                      <div>
                        <span className="text-white font-mono font-medium text-sm">{c.symbol}</span>
                        <span className="text-slate-500 text-xs ml-2">{c.company_name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-red-400 text-sm font-mono">{(+c.share_change || 0).toLocaleString()}</div>
                        <div className="text-slate-500 text-xs">{getChangeTypeLabel(c.change_type).label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Mock data
const MOCK_DETAIL = {
  name: 'Berkshire Hathaway Inc', name_zh: '伯克希尔·哈撒韦', cik: '0000102909',
  type: '持股公司', country: 'US', aum: 3.6e11, filing_date: '2024-02-14',
  holdings_count: 45, total_holdings_value: 3.2e11, latest_quarter: '2024Q4',
  topHoldings: MOCK_TOP_HOLDINGS, sectorAllocation: MOCK_SECTORS, recentChanges: MOCK_CHANGES,
};
const MOCK_TOP_HOLDINGS = [
  { symbol: 'AAPL', company_name: 'Apple Inc', market_value: 1.74e11, portfolio_pct: 46.2 },
  { symbol: 'BAC', company_name: 'Bank of America', market_value: 3.5e10, portfolio_pct: 9.3 },
  { symbol: 'AXP', company_name: 'American Express', market_value: 3.2e10, portfolio_pct: 8.5 },
  { symbol: 'KO', company_name: 'Coca-Cola', market_value: 2.4e10, portfolio_pct: 6.4 },
  { symbol: 'CVX', company_name: 'Chevron', market_value: 1.9e10, portfolio_pct: 5.1 },
];
const MOCK_SECTORS = [
  { sector: 'Technology', pct: 47.2 }, { sector: 'Financial', pct: 26.8 },
  { sector: 'Consumer', pct: 11.4 }, { sector: 'Energy', pct: 8.1 },
  { sector: 'Healthcare', pct: 4.2 }, { sector: 'Other', pct: 2.3 },
];
const MOCK_CHANGES = [
  { symbol: 'OXY', company_name: 'Occidental Petroleum', change_type: 'buy', share_change: 8500000 },
  { symbol: 'CVX', company_name: 'Chevron', change_type: 'buy', share_change: 2100000 },
  { symbol: 'SIRI', company_name: 'Sirius XM', change_type: 'new', share_change: 125000000 },
  { symbol: 'AAPL', company_name: 'Apple Inc', change_type: 'sell', share_change: -10000000 },
  { symbol: 'HPQ', company_name: 'HP Inc', change_type: 'sell', share_change: -5000000 },
  { symbol: 'GM', company_name: 'General Motors', change_type: 'closed', share_change: -22000000 },
];
const MOCK_HOLDINGS = MOCK_TOP_HOLDINGS.map((h, i) => ({ ...h, shares: Math.floor(h.market_value / 100), sector: MOCK_SECTORS[i % MOCK_SECTORS.length].sector, change_type: ['hold', 'buy', 'sell', 'new', 'hold'][i % 5] }));
