'use client';
import ReactECharts from 'echarts-for-react';

export function FinancialsChart({ data, symbol }: { data: any[]; symbol: string }) {
  if (!data?.length) return (
    <div className="text-center py-12 text-slate-500">暂无财务数据</div>
  );
  
  const periods = data.map(d => d.period);
  const revenues = data.map(d => ((+d.revenue||0)/1e9).toFixed(2));
  const netIncomes = data.map(d => ((+d.net_income||0)/1e9).toFixed(2));
  
  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['营收(B$)', '净利润(B$)'], textStyle: { color: '#94a3b8' } },
    xAxis: { type: 'category', data: periods, axisLabel: { color: '#64748b' }, axisLine: { lineStyle: { color: '#1e2d4a' } } },
    yAxis: { type: 'value', axisLabel: { color: '#64748b', formatter: (v: number) => `$${v}B` }, splitLine: { lineStyle: { color: '#1e2d4a' } } },
    series: [
      { name: '营收(B$)', type: 'bar', data: revenues, itemStyle: { color: '#3b82f6', borderRadius: [4,4,0,0] } },
      { name: '净利润(B$)', type: 'bar', data: netIncomes, itemStyle: { color: '#10b981', borderRadius: [4,4,0,0] } },
    ],
  };
  
  return <ReactECharts option={option} style={{ height: '360px' }} />;
}
