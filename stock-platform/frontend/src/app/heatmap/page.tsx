'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ReactECharts from 'echarts-for-react';
import { Map, RefreshCw, Info } from 'lucide-react';
import { api } from '@/lib/api';

interface HeatmapItem {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
  market_cap: number;
  sector: string;
  volume: number;
}

type ViewMode = 'individual' | 'sector';

export default function HeatmapPage() {
  const router = useRouter();
  const [data, setData] = useState<HeatmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('individual');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<HeatmapItem | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/heatmap');
      setData(res.data?.data || getMockHeatmapData());
    } catch {
      setData(getMockHeatmapData());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ============================================================
  // 个股热力图配置
  // ============================================================
  const getIndividualOption = useCallback(() => {
    const treeData = data.map((item) => ({
      name: item.symbol,
      value: item.market_cap || 1e9,
      changePct: item.change_pct || 0,
      price: item.price,
      sector: item.sector,
      label: {
        show: true,
        formatter: () => `{symbol|${item.symbol}}\n{pct|${item.change_pct >= 0 ? '+' : ''}${Number(item.change_pct).toFixed(2)}%}`,
        rich: {
          symbol: { fontSize: 13, fontWeight: 'bold', color: '#fff', lineHeight: 20 },
          pct: { fontSize: 11, color: getColor(item.change_pct, 0.85), lineHeight: 16 },
        },
      },
      itemStyle: { color: getHeatColor(item.change_pct) },
    }));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => {
          const d = data.find((x) => x.symbol === p.name);
          if (!d) return '';
          return `<div style="background:#0d1525;border:1px solid #1e2d4a;border-radius:8px;padding:10px 14px;font-size:12px;">
            <div style="font-size:14px;font-weight:bold;color:#fff;margin-bottom:6px;">${d.symbol} · ${d.name}</div>
            <div style="color:#94a3b8">价格：<span style="color:#fff">$${Number(d.price).toFixed(2)}</span></div>
            <div style="color:#94a3b8">涨跌幅：<span style="color:${d.change_pct >= 0 ? '#10b981' : '#ef4444'}">${d.change_pct >= 0 ? '+' : ''}${Number(d.change_pct).toFixed(2)}%</span></div>
            <div style="color:#94a3b8">市值：<span style="color:#fff">$${(d.market_cap / 1e9).toFixed(1)}B</span></div>
            <div style="color:#94a3b8">行业：<span style="color:#60a5fa">${d.sector}</span></div>
          </div>`;
        },
      },
      series: [{
        type: 'treemap',
        data: treeData,
        width: '100%',
        height: '100%',
        roam: false,
        nodeClick: 'zoomToNode',
        breadcrumb: { show: false },
        label: { position: 'insideTopLeft', distance: 8 },
        itemStyle: {
          borderWidth: 2,
          borderColor: '#0a0e1a',
          gapWidth: 2,
        },
        emphasis: {
          label: { show: true },
          itemStyle: { borderColor: '#3b82f6', borderWidth: 2 },
        },
        levels: [
          { itemStyle: { borderWidth: 3, borderColor: '#0a0e1a', gapWidth: 3 } },
        ],
      }],
    };
  }, [data]);

  // ============================================================
  // 行业热力图配置
  // ============================================================
  const getSectorOption = useCallback(() => {
    // 按行业聚合
    const sectorMap = new Map<string, { items: HeatmapItem[]; totalCap: number; avgChange: number }>();
    data.forEach((item) => {
      const s = item.sector || 'Other';
      if (!sectorMap.has(s)) sectorMap.set(s, { items: [], totalCap: 0, avgChange: 0 });
      const sec = sectorMap.get(s)!;
      sec.items.push(item);
      sec.totalCap += item.market_cap || 0;
    });

    // 计算加权平均涨跌幅
    sectorMap.forEach((sec) => {
      const totalCap = sec.items.reduce((a, b) => a + (b.market_cap || 0), 0);
      sec.avgChange = totalCap > 0
        ? sec.items.reduce((a, b) => a + (b.change_pct || 0) * (b.market_cap || 0), 0) / totalCap
        : 0;
    });

    const sectorData = Array.from(sectorMap.entries()).map(([name, sec]) => ({
      name,
      value: sec.totalCap,
      avgChange: sec.avgChange,
      count: sec.items.length,
      label: {
        show: true,
        formatter: () => `{name|${name}}\n{pct|${sec.avgChange >= 0 ? '+' : ''}${sec.avgChange.toFixed(2)}%}\n{count|${sec.items.length}只}`,
        rich: {
          name: { fontSize: 14, fontWeight: 'bold', color: '#fff', lineHeight: 22 },
          pct: { fontSize: 12, color: getColor(sec.avgChange, 0.9), lineHeight: 18 },
          count: { fontSize: 11, color: '#64748b', lineHeight: 16 },
        },
      },
      itemStyle: { color: getHeatColor(sec.avgChange) },
    }));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => {
          const d = sectorMap.get(p.name);
          if (!d) return '';
          return `<div style="background:#0d1525;border:1px solid #1e2d4a;border-radius:8px;padding:10px 14px;font-size:12px;">
            <div style="font-size:14px;font-weight:bold;color:#fff;margin-bottom:6px;">${p.name}</div>
            <div style="color:#94a3b8">平均涨跌：<span style="color:${d.avgChange >= 0 ? '#10b981' : '#ef4444'}">${d.avgChange >= 0 ? '+' : ''}${d.avgChange.toFixed(2)}%</span></div>
            <div style="color:#94a3b8">总市值：$${(d.totalCap / 1e12).toFixed(2)}T</div>
            <div style="color:#94a3b8">股票数：${d.items.length}只</div>
          </div>`;
        },
      },
      series: [{
        type: 'treemap',
        data: sectorData,
        width: '100%',
        height: '100%',
        roam: false,
        breadcrumb: { show: false },
        label: { position: 'inside', distance: 8 },
        itemStyle: { borderWidth: 3, borderColor: '#0a0e1a', gapWidth: 3 },
        emphasis: { itemStyle: { borderColor: '#3b82f6', borderWidth: 2 } },
      }],
    };
  }, [data]);

  const handleChartClick = (params: any) => {
    if (viewMode === 'individual' && params.name) {
      router.push(`/stocks/${params.name}`);
    }
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in h-full flex flex-col">
      {/* 顶部 */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Map className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold text-white">市场热力图</h1>
            <p className="text-xs text-slate-400">面积=市值 · 颜色=涨跌幅 · 点击跳转详情</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* 视图切换 */}
          <div className="flex gap-1 bg-[#131c2e] p-1 rounded-lg border border-[#1e2d4a]">
            <button onClick={() => setViewMode('individual')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${viewMode === 'individual' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              个股
            </button>
            <button onClick={() => setViewMode('sector')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${viewMode === 'sector' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              行业
            </button>
          </div>
          <button onClick={fetchData} className="btn-ghost">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 色阶图例 */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-xs text-slate-500">跌</span>
        {[-5, -3, -1, 0, 1, 3, 5].map((v) => (
          <div key={v} className="flex flex-col items-center gap-1">
            <div className="w-8 h-4 rounded" style={{ background: getHeatColor(v) }} />
            <span className="text-[10px] text-slate-600">{v > 0 ? '+' : ''}{v}%</span>
          </div>
        ))}
        <span className="text-xs text-slate-500">涨</span>
        <div className="ml-4 text-xs text-slate-500 flex items-center gap-1">
          <Info className="w-3 h-3" /> 点击个股跳转详情
        </div>
      </div>

      {/* 热力图主体 */}
      <div className="card flex-1 p-2" style={{ minHeight: '500px' }}>
        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> 加载中...
          </div>
        ) : (
          <ReactECharts
            option={viewMode === 'individual' ? getIndividualOption() : getSectorOption()}
            style={{ width: '100%', height: '100%' }}
            onEvents={{ click: handleChartClick }}
            notMerge
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// 工具函数
// ============================================================
function getHeatColor(pct: number): string {
  const p = Number(pct) || 0;
  if (p >= 5) return '#065f46';
  if (p >= 3) return '#047857';
  if (p >= 1) return '#059669';
  if (p >= 0) return '#10b981';
  if (p >= -1) return '#dc2626';
  if (p >= -3) return '#b91c1c';
  if (p >= -5) return '#991b1b';
  return '#7f1d1d';
}

function getColor(pct: number, alpha = 1): string {
  return pct >= 0
    ? `rgba(52,211,153,${alpha})`
    : `rgba(248,113,113,${alpha})`;
}

function getMockHeatmapData(): HeatmapItem[] {
  const stocks = [
    { symbol: 'NVDA', name: 'NVIDIA', change_pct: 4.21, market_cap: 2.16e12, sector: 'Technology' },
    { symbol: 'AAPL', name: 'Apple', change_pct: -0.63, market_cap: 2.94e12, sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft', change_pct: -0.76, market_cap: 3.08e12, sector: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon', change_pct: 2.81, market_cap: 1.95e12, sector: 'Consumer Discretionary' },
    { symbol: 'META', name: 'Meta', change_pct: 2.43, market_cap: 1.32e12, sector: 'Communication Services' },
    { symbol: 'GOOGL', name: 'Alphabet', change_pct: 1.12, market_cap: 1.85e12, sector: 'Communication Services' },
    { symbol: 'TSLA', name: 'Tesla', change_pct: 4.38, market_cap: 6.48e11, sector: 'Consumer Discretionary' },
    { symbol: 'BRK-B', name: 'Berkshire', change_pct: 0.32, market_cap: 8.7e11, sector: 'Financial' },
    { symbol: 'JPM', name: 'JPMorgan', change_pct: -1.45, market_cap: 5.6e11, sector: 'Financial' },
    { symbol: 'V', name: 'Visa', change_pct: 0.87, market_cap: 5.5e11, sector: 'Financial' },
    { symbol: 'UNH', name: 'UnitedHealth', change_pct: -2.3, market_cap: 4.6e11, sector: 'Healthcare' },
    { symbol: 'XOM', name: 'ExxonMobil', change_pct: 1.5, market_cap: 4.5e11, sector: 'Energy' },
    { symbol: 'AVGO', name: 'Broadcom', change_pct: 3.2, market_cap: 7.2e11, sector: 'Technology' },
    { symbol: 'LLY', name: 'Eli Lilly', change_pct: -1.1, market_cap: 7.8e11, sector: 'Healthcare' },
    { symbol: 'AMD', name: 'AMD', change_pct: 5.1, market_cap: 2.5e11, sector: 'Technology' },
    { symbol: 'QCOM', name: 'Qualcomm', change_pct: 2.8, market_cap: 1.8e11, sector: 'Technology' },
    { symbol: 'NFLX', name: 'Netflix', change_pct: -3.2, market_cap: 2.4e11, sector: 'Communication Services' },
    { symbol: 'COST', name: 'Costco', change_pct: 0.4, market_cap: 3.2e11, sector: 'Consumer Staples' },
    { symbol: 'WMT', name: 'Walmart', change_pct: -0.8, market_cap: 5.1e11, sector: 'Consumer Staples' },
    { symbol: 'PG', name: 'P&G', change_pct: 0.2, market_cap: 3.8e11, sector: 'Consumer Staples' },
  ];
  return stocks.map((s) => ({ ...s, price: Math.random() * 500 + 50, volume: Math.floor(Math.random() * 1e8) }));
}
