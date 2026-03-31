'use client';
import Link from 'next/link';

const stocks = [
  { s:'NVDA', p:4.21 }, { s:'AAPL', p:-0.63 }, { s:'MSFT', p:-0.76 },
  { s:'AMZN', p:2.81 }, { s:'META', p:2.43 }, { s:'TSLA', p:4.38 },
  { s:'GOOGL', p:1.12 }, { s:'AMD', p:5.10 }, { s:'NFLX', p:-3.20 },
];
function heatColor(p:number){ return p>=3?'#047857':p>=1?'#059669':p>=0?'#10b981':p>=-1?'#dc2626':p>=-3?'#b91c1c':'#7f1d1d'; }

export function MiniHeatmap() {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {stocks.map(({s,p}) => (
        <Link key={s} href={`/stocks/${s}`}
          className="rounded-lg p-2 flex flex-col items-center gap-0.5 cursor-pointer hover:opacity-80 transition-opacity"
          style={{ background: heatColor(p) }}>
          <span className="text-xs font-bold text-white">{s}</span>
          <span className="text-[10px] text-white/80">{p>0?'+':''}{p.toFixed(2)}%</span>
        </Link>
      ))}
    </div>
  );
}
