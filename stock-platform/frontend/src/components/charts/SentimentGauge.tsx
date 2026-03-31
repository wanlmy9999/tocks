'use client';
import ReactECharts from 'echarts-for-react';

export function SentimentGauge({ data }: { data: any }) {
  const pos = data?.positive_pct || 45;
  const neu = data?.neutral_pct || 35;
  const neg = data?.negative_pct || 20;
  
  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: { show: false },
    series: [{
      type: 'pie',
      radius: ['55%', '80%'],
      avoidLabelOverlap: false,
      label: { show: false },
      data: [
        { value: pos, name: '积极', itemStyle: { color: '#10b981' } },
        { value: neu, name: '中性', itemStyle: { color: '#3b82f6' } },
        { value: neg, name: '消极', itemStyle: { color: '#ef4444' } },
      ],
    }],
  };
  
  return (
    <div className="relative">
      <ReactECharts option={option} style={{ height: '180px' }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-emerald-400">{pos}%</span>
        <span className="text-xs text-slate-500">积极情绪</span>
      </div>
      <div className="flex justify-around mt-2 text-xs">
        <span className="text-emerald-400">积极 {pos}%</span>
        <span className="text-blue-400">中性 {neu}%</span>
        <span className="text-red-400">消极 {neg}%</span>
      </div>
    </div>
  );
}
