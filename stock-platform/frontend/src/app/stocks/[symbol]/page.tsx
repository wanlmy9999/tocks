'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { TrendingUp, TrendingDown, Download, RefreshCw, BarChart2, FileText, Brain } from 'lucide-react';
import { KlineChart } from '@/components/charts/KlineChart';
import { SentimentGauge } from '@/components/charts/SentimentGauge';
import { FinancialsChart } from '@/components/charts/FinancialsChart';
import { NewsCard } from '@/components/ui/NewsCard';
import { ReportDownload } from '@/components/ui/ReportDownload';
import { api } from '@/lib/api';
import { formatPrice, formatPercent, formatNumber, formatMarketCap } from '@/lib/format';

type Period = '5m' | '15m' | '1h' | '1d' | '1w' | '1m';

export default function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const [stock, setStock] = useState<any>(null);
  const [klines, setKlines] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [sentiment, setSentiment] = useState<any>(null);
  const [financials, setFinancials] = useState<any[]>([]);
  const [period, setPeriod] = useState<Period>('1d');
  const [activeTab, setActiveTab] = useState<'chart' | 'news' | 'financials' | 'ai'>('chart');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!symbol) return;
    try {
      const [stockRes, newsRes, sentimentRes, financialsRes] = await Promise.allSettled([
        api.get(`/stocks/${symbol}`),
        api.get(`/stocks/${symbol}/news`),
        api.get(`/stocks/${symbol}/sentiment`),
        api.get(`/stocks/${symbol}/financials`),
      ]);
      if (stockRes.status === 'fulfilled') setStock(stockRes.value.data?.data);
      if (newsRes.status === 'fulfilled') setNews(newsRes.value.data?.data || []);
      if (sentimentRes.status === 'fulfilled') setSentiment(sentimentRes.value.data?.data);
      if (financialsRes.status === 'fulfilled') setFinancials(financialsRes.value.data?.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  const fetchKlines = useCallback(async (p: Period) => {
    if (!symbol) return;
    try {
      const res = await api.get(`/stocks/${symbol}/klines?period=${p}&limit=300`);
      setKlines(res.data?.data || []);
    } catch (e) {}
  }, [symbol]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchKlines(period); }, [fetchKlines, period]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAll(), fetchKlines(period)]);
    setRefreshing(false);
  };

  if (loading) return <StockDetailSkeleton />;

  const quote = stock?.quote || {};
  const isUp = parseFloat(quote.change_pct || 0) >= 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* ===== 股票头部信息 ===== */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* 左：基本信息 */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600/30 to-purple-600/30 border border-blue-500/20 flex items-center justify-center text-lg font-bold text-blue-400">
                {symbol?.slice(0, 2)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{symbol}</h1>
                <p className="text-slate-400 text-sm">
                  {stock?.nameZh || stock?.nameEn} · {stock?.exchange} · {stock?.sector}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={handleRefresh} disabled={refreshing}
                  className="btn-ghost">
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={() => setShowReport(true)} className="btn-primary">
                  <Download className="w-4 h-4" />
                  下载报告
                </button>
              </div>
            </div>

            {/* 价格区域 */}
            <div className="flex items-baseline gap-4 mt-4">
              <span className="text-4xl font-bold font-mono text-white">
                ${formatPrice(quote.price)}
              </span>
              <span className={`flex items-center gap-1 text-lg font-semibold ${isUp ? 'price-up' : 'price-down'}`}>
                {isUp ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                {isUp ? '+' : ''}{formatPrice(quote.change)} ({formatPercent(quote.change_pct)})
              </span>
            </div>
          </div>

          {/* 右：关键指标网格 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:w-auto w-full">
            {[
              { label: '市值', value: formatMarketCap(quote.market_cap) },
              { label: '市盈率', value: formatPrice(quote.pe_ratio) + 'x' },
              { label: '成交量', value: formatNumber(quote.volume) },
              { label: '今日开盘', value: '$' + formatPrice(quote.open) },
              { label: '52周最高', value: '$' + formatPrice(quote.week_52_high) },
              { label: '52周最低', value: '$' + formatPrice(quote.week_52_low) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#0d1525] rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">{label}</div>
                <div className="text-sm font-semibold text-white">{value || 'N/A'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Tab切换 ===== */}
      <div className="flex gap-1 bg-[#131c2e] p-1 rounded-xl border border-[#1e2d4a] w-fit">
        {([
          { key: 'chart', label: 'K线图', icon: BarChart2 },
          { key: 'news', label: '新闻', icon: FileText },
          { key: 'financials', label: '财务', icon: TrendingUp },
          { key: 'ai', label: 'AI分析', icon: Brain },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ===== 主内容区 ===== */}
      {activeTab === 'chart' && (
        <div className="space-y-4">
          {/* K线图 */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title mb-0">K线图</h2>
              {/* 周期切换 */}
              <div className="flex gap-1">
                {(['5m','15m','1h','1d','1w','1m'] as Period[]).map((p) => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      period === p ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[420px]">
              <KlineChart data={klines} symbol={symbol as string} period={period} />
            </div>
          </div>

          {/* 情绪分析 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4">
              <h3 className="section-title">市场情绪</h3>
              <SentimentGauge data={sentiment} />
            </div>
            <div className="card p-4 md:col-span-2">
              <h3 className="section-title">最新动态</h3>
              <div className="space-y-3">
                {news.slice(0, 3).map((n, i) => (
                  <NewsCard key={i} news={n} compact />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'news' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {news.length > 0
            ? news.map((n, i) => <NewsCard key={i} news={n} />)
            : <div className="col-span-2 text-center py-12 text-slate-500">暂无新闻数据</div>
          }
        </div>
      )}

      {activeTab === 'financials' && (
        <div className="card p-6">
          <h2 className="section-title">财务数据</h2>
          <FinancialsChart data={financials} symbol={symbol as string} />
        </div>
      )}

      {activeTab === 'ai' && (
        <AIAnalysisPanel symbol={symbol as string} stockData={{ stock, quote, sentiment, financials, news }} />
      )}

      {/* 报告下载弹窗 */}
      {showReport && (
        <ReportDownload symbol={symbol as string} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}

// ============================================================
// AI分析面板
// ============================================================
function AIAnalysisPanel({ symbol, stockData }: { symbol: string; stockData: any }) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await api.post('/ai/analyze', { symbol, data: stockData });
      setAnalysis(res.data?.data?.analysis || '');
    } catch (e) {
      setAnalysis('AI分析服务暂时不可用，请检查API Key配置。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title mb-0">
          <Brain className="w-5 h-5 text-purple-400" />
          AI投研分析
        </h2>
        <button onClick={runAnalysis} disabled={loading} className="btn-primary">
          {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> 分析中...</> : '生成分析'}
        </button>
      </div>
      {analysis ? (
        <div className="prose prose-invert max-w-none">
          <div className="bg-[#0d1525] rounded-xl p-5 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap border border-[#1e2d4a]">
            {analysis}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-slate-500">
          <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>点击「生成分析」获取AI投研报告</p>
          <p className="text-xs mt-1">支持 OpenAI / Claude / Gemini</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 加载骨架屏
// ============================================================
function StockDetailSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="card p-6">
        <div className="flex gap-4">
          <div className="skeleton w-12 h-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-6 w-32 rounded" />
            <div className="skeleton h-4 w-48 rounded" />
            <div className="skeleton h-8 w-40 rounded mt-4" />
          </div>
        </div>
      </div>
      <div className="card p-4">
        <div className="skeleton h-[420px] rounded-lg" />
      </div>
    </div>
  );
}
