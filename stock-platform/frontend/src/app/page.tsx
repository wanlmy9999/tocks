'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Activity, Building2, Map, FileText, Search, Zap } from 'lucide-react';
import { SearchBar } from '@/components/ui/SearchBar';
import { MarketOverview } from '@/components/ui/MarketOverview';
import { TopMovers } from '@/components/ui/TopMovers';
import { MiniHeatmap } from '@/components/charts/MiniHeatmap';
import { useStockStore } from '@/store/stockStore';
import { formatPrice, formatPercent } from '@/lib/format';

export default function HomePage() {
  const { marketData, fetchMarketData } = useStockStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarketData().finally(() => setLoading(false));
    const interval = setInterval(fetchMarketData, 30000);
    return () => clearInterval(interval);
  }, []);

  const quickLinks = [
    { href: '/heatmap', icon: Map, label: '热力图', desc: '市场全景', color: 'from-blue-600 to-cyan-500' },
    { href: '/institutions', icon: Building2, label: '机构追踪', desc: '13F持仓', color: 'from-purple-600 to-violet-500' },
    { href: '/reports', icon: FileText, label: '报告生成', desc: 'MD/Excel/PPT', color: 'from-emerald-600 to-teal-500' },
    { href: '/search', icon: Search, label: '股票搜索', desc: '中英文/代码', color: 'from-orange-600 to-amber-500' },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* 顶部标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-400" />
            市场概览
          </h1>
          <p className="text-sm text-slate-400 mt-1">实时数据 · AI驱动 · 专业分析</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            数据实时更新
          </span>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="max-w-2xl">
        <SearchBar placeholder="搜索股票（英伟达 / NVIDIA / NVDA）..." />
      </div>

      {/* 快捷导航 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickLinks.map(({ href, icon: Icon, label, desc, color }) => (
          <Link key={href} href={href}
            className="card-hover p-4 flex items-center gap-3 group cursor-pointer">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">
                {label}
              </div>
              <div className="text-xs text-slate-500">{desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* 主要指数 */}
      <MarketOverview loading={loading} />

      {/* 主内容区 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* 涨跌榜 */}
        <div className="xl:col-span-2">
          <TopMovers loading={loading} />
        </div>

        {/* 迷你热力图 */}
        <div className="card p-4">
          <div className="section-title">
            <Map className="w-4 h-4 text-blue-400" />
            市场热力
            <Link href="/heatmap" className="ml-auto text-xs text-blue-400 hover:text-blue-300">
              查看完整 →
            </Link>
          </div>
          <MiniHeatmap />
        </div>
      </div>

      {/* 热门股票列表 */}
      <WatchlistSection />
    </div>
  );
}

// ============================================================
// 热门股票组件
// ============================================================
function WatchlistSection() {
  const hotStocks = [
    { symbol: 'NVDA', name: '英伟达', price: 875.39, change: 4.21, changePct: 2.1 },
    { symbol: 'AAPL', name: '苹果', price: 189.30, change: -1.20, changePct: -0.63 },
    { symbol: 'TSLA', name: '特斯拉', price: 202.64, change: 8.50, changePct: 4.38 },
    { symbol: 'META', name: 'Meta', price: 519.83, change: 12.33, changePct: 2.43 },
    { symbol: 'MSFT', name: '微软', price: 415.50, change: -3.20, changePct: -0.76 },
    { symbol: 'AMZN', name: '亚马逊', price: 186.40, change: 5.10, changePct: 2.81 },
  ];

  return (
    <div className="card">
      <div className="p-4 border-b border-[#1e2d4a] flex items-center justify-between">
        <h2 className="section-title mb-0">
          <Activity className="w-4 h-4 text-blue-400" />
          热门股票
        </h2>
        <Link href="/search" className="text-xs text-blue-400 hover:text-blue-300">
          查看全部 →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>股票</th>
              <th className="text-right">价格</th>
              <th className="text-right">涨跌</th>
              <th className="text-right">涨跌幅</th>
              <th className="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {hotStocks.map((stock) => {
              const isUp = stock.changePct >= 0;
              return (
                <tr key={stock.symbol} className="cursor-pointer">
                  <td>
                    <Link href={`/stocks/${stock.symbol}`} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">
                        {stock.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm">{stock.symbol}</div>
                        <div className="text-xs text-slate-500">{stock.name}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="text-right font-mono font-semibold text-white">
                    ${formatPrice(stock.price)}
                  </td>
                  <td className={`text-right font-mono text-sm ${isUp ? 'price-up' : 'price-down'}`}>
                    {isUp ? '+' : ''}{formatPrice(stock.change)}
                  </td>
                  <td className="text-right">
                    <span className={`badge ${isUp ? 'badge-green' : 'badge-red'}`}>
                      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(stock.changePct).toFixed(2)}%
                    </span>
                  </td>
                  <td className="text-right">
                    <Link href={`/stocks/${stock.symbol}`} className="btn-ghost text-xs">
                      详情
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
