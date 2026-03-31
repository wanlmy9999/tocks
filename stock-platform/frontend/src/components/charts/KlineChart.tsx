'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  CrosshairMode,
  ColorType,
} from 'lightweight-charts';

interface KlineItem {
  open_time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  data: KlineItem[];
  symbol: string;
  period: string;
}

export function KlineChart({ data, symbol, period }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [tooltip, setTooltip] = useState<any>(null);

  // 初始化图表
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontSize: 12,
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: '#1e2d4a', style: 1 },
        horzLines: { color: '#1e2d4a', style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#3b82f6', width: 1, style: 1, labelBackgroundColor: '#1e40af' },
        horzLine: { color: '#3b82f6', width: 1, style: 1, labelBackgroundColor: '#1e40af' },
      },
      rightPriceScale: {
        borderColor: '#1e2d4a',
        textColor: '#64748b',
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: '#1e2d4a',
        textColor: '#64748b',
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScale: true,
      handleScroll: true,
    });

    chartRef.current = chart;

    // K线系列
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    candleRef.current = candleSeries;

    // 成交量系列
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeRef.current = volumeSeries;

    // 十字线监听 → 更新tooltip
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setTooltip(null);
        return;
      }
      const candle = param.seriesData.get(candleSeries) as CandlestickData;
      const vol = param.seriesData.get(volumeSeries) as HistogramData;
      if (candle) {
        setTooltip({
          time: param.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: vol?.value,
          x: param.point.x,
          y: param.point.y,
        });
      }
    });

    // 响应式
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // 更新数据
  useEffect(() => {
    if (!candleRef.current || !volumeRef.current || !data.length) return;

    const candleData: CandlestickData[] = [];
    const volumeData: HistogramData[] = [];

    data.forEach((item) => {
      const time = Math.floor(new Date(item.open_time).getTime() / 1000) as any;
      const isUp = item.close >= item.open;
      candleData.push({
        time,
        open: parseFloat(item.open as any),
        high: parseFloat(item.high as any),
        low: parseFloat(item.low as any),
        close: parseFloat(item.close as any),
      });
      volumeData.push({
        time,
        value: parseFloat(item.volume as any),
        color: isUp ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)',
      });
    });

    candleRef.current.setData(candleData);
    volumeRef.current.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="relative w-full h-full">
      {/* tooltip */}
      {tooltip && (
        <div className="absolute top-2 left-2 z-10 bg-[#0d1525]/90 border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs font-mono pointer-events-none">
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            <span className="text-slate-500">开</span>
            <span className="text-white">{Number(tooltip.open).toFixed(2)}</span>
            <span className="text-slate-500">高</span>
            <span className="text-emerald-400">{Number(tooltip.high).toFixed(2)}</span>
            <span className="text-slate-500">低</span>
            <span className="text-red-400">{Number(tooltip.low).toFixed(2)}</span>
            <span className="text-slate-500">收</span>
            <span className={tooltip.close >= tooltip.open ? 'text-emerald-400' : 'text-red-400'}>
              {Number(tooltip.close).toFixed(2)}
            </span>
            {tooltip.volume && (
              <>
                <span className="text-slate-500">量</span>
                <span className="text-blue-400">
                  {(Number(tooltip.volume) / 1e6).toFixed(1)}M
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 无数据提示 */}
      {!data.length && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
          暂无K线数据
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
