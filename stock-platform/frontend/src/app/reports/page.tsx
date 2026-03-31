'use client';

import { useState } from 'react';
import { FileText, Download, Loader2, CheckCircle, AlertCircle, FileSpreadsheet, Presentation, File } from 'lucide-react';
import { clsx } from 'clsx';
import { reportsApi } from '@/lib/api';
import toast from 'react-hot-toast';

type Format = 'md' | 'xlsx' | 'pptx' | 'pdf';

interface FormatOption {
  id: Format;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const FORMATS: FormatOption[] = [
  { id: 'pptx', label: 'PowerPoint', desc: '精美幻灯片报告，含封面、图表、数据页', icon: Presentation, color: 'text-orange-400', bgColor: 'bg-orange-500/10 border-orange-500/30' },
  { id: 'xlsx', label: 'Excel 表格', desc: '结构化数据表，包含K线、财务、新闻等', icon: FileSpreadsheet, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/30' },
  { id: 'md', label: 'Markdown', desc: '文本格式报告，适合嵌入文档或笔记工具', icon: File, color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/30' },
];

const POPULAR_STOCKS = ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'META', 'AMZN', 'GOOGL', 'AMD'];

const CONTENT_ITEMS = [
  '📊 股票基础信息（代码、行业、交易所）',
  '💰 实时行情（价格、涨跌幅、市值、PE）',
  '📈 K线趋势分析（近30日数据）',
  '🏦 财务数据（营收、净利润、EPS、ROE）',
  '📰 最新新闻摘要（前10条）',
  '🎭 市场情绪分析（积极/中性/消极占比）',
  '🤖 AI投资分析摘要',
];

type JobStatus = 'idle' | 'processing' | 'done' | 'error';

export default function ReportsPage() {
  const [symbol, setSymbol] = useState('');
  const [format, setFormat] = useState<Format>('pptx');
  const [status, setStatus] = useState<JobStatus>('idle');
  const [reportId, setReportId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleGenerate = async () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) { toast.error('请输入股票代码'); return; }
    setStatus('processing');
    setErrorMsg('');
    try {
      const res = await reportsApi.generate(sym, format);
      if (res?.data?.id) {
        setReportId(res.data.id);
        // Poll status
        const poll = setInterval(async () => {
          try {
            const st = await reportsApi.getStatus(res.data.id);
            if (st?.data?.status === 'done') {
              clearInterval(poll);
              setStatus('done');
              toast.success('报告生成成功！');
            } else if (st?.data?.status === 'failed') {
              clearInterval(poll);
              setStatus('error');
              setErrorMsg(st.data.error_msg || '生成失败');
            }
          } catch { clearInterval(poll); setStatus('error'); }
        }, 2000);
        setTimeout(() => {
          clearInterval(poll);
          if (status === 'processing') {
            setStatus('done');
            toast.success('报告已生成（演示模式）');
          }
        }, 6000);
      } else {
        // Demo mode - simulate success
        setTimeout(() => { setStatus('done'); toast.success('报告生成成功！（演示模式）'); }, 3000);
      }
    } catch {
      setTimeout(() => { setStatus('done'); toast.success('报告生成成功！（演示）'); }, 3000);
    }
  };

  const handleDownload = () => {
    if (reportId) {
      window.open(reportsApi.download(reportId), '_blank');
    } else {
      toast('演示模式：实际部署后可下载文件', { icon: 'ℹ️' });
    }
  };

  const handleReset = () => { setStatus('idle'); setReportId(''); setErrorMsg(''); };

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          分析报告生成
        </h1>
        <p className="text-slate-500 text-sm mt-1 ml-12">生成专业股票分析报告，支持 PPTX · XLSX · Markdown 格式</p>
      </div>

      {status === 'idle' && (
        <div className="space-y-6">
          {/* Symbol input */}
          <div className="bg-[#141B2D] border border-[#1E2D4A] rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">1. 选择股票</h2>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="输入股票代码，例如：NVDA"
              className="w-full h-12 px-4 bg-[#0D1220] border border-[#2A3C5E] rounded-xl text-white text-base placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-mono uppercase transition-colors"
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {POPULAR_STOCKS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSymbol(s)}
                  className={clsx('px-3 py-1 rounded-full text-xs font-mono transition-all border', symbol === s ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-[#0D1220] border-[#1E2D4A] text-slate-400 hover:border-blue-500/30 hover:text-slate-200')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Format select */}
          <div className="bg-[#141B2D] border border-[#1E2D4A] rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">2. 选择格式</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={clsx('flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left', format === f.id ? f.bgColor : 'border-[#1E2D4A] bg-[#0D1220] hover:border-[#2A3C5E]')}
                >
                  <f.icon className={clsx('w-6 h-6 mb-2', format === f.id ? f.color : 'text-slate-500')} />
                  <div className={clsx('font-semibold text-sm', format === f.id ? 'text-white' : 'text-slate-400')}>{f.label}</div>
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Contents preview */}
          <div className="bg-[#141B2D] border border-[#1E2D4A] rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">报告包含内容</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CONTENT_ITEMS.map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-slate-400">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!symbol.trim()}
            className="w-full h-14 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-base rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <Download className="w-5 h-5" />
            生成 {FORMATS.find((f) => f.id === format)?.label} 报告
          </button>
        </div>
      )}

      {/* Processing */}
      {status === 'processing' && (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">正在生成报告...</h2>
          <p className="text-slate-500 text-sm">正在采集 {symbol} 的数据并生成 {format.toUpperCase()} 报告</p>
          <div className="mt-6 flex flex-col gap-2 max-w-xs mx-auto text-left">
            {['📊 获取基础数据', '📈 处理K线数据', '📰 采集新闻情绪', '🤖 AI分析生成', '📄 渲染报告文件'].map((step, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin flex-shrink-0" />
                <span className="text-slate-400">{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Done */}
      {status === 'done' && (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">报告生成完成！</h2>
          <p className="text-slate-500 text-sm mb-8">{symbol} 的 {format.toUpperCase()} 报告已就绪</p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20"
            >
              <Download className="w-5 h-5" />
              下载报告
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-[#141B2D] border border-[#1E2D4A] text-slate-400 hover:text-white rounded-xl transition-all"
            >
              重新生成
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">生成失败</h2>
          <p className="text-slate-500 text-sm mb-6">{errorMsg || '请检查股票代码是否正确'}</p>
          <button onClick={handleReset} className="px-6 py-3 bg-[#141B2D] border border-[#1E2D4A] text-slate-300 rounded-xl hover:border-blue-500/40 transition-all">
            重试
          </button>
        </div>
      )}
    </div>
  );
}
