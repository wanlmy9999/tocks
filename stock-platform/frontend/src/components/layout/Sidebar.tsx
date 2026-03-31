'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, BarChart2, Building2, Map, FileText, TrendingUp, Settings, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { href: '/', icon: Home, label: '首页', desc: '市场总览' },
  { href: '/search', icon: Search, label: '搜索', desc: '查找股票' },
  { href: '/heatmap', icon: Map, label: '热力图', desc: '市场全景' },
  { href: '/institutions', icon: Building2, label: '机构追踪', desc: '13F持仓' },
  { href: '/reports', icon: FileText, label: '报告生成', desc: '多格式下载' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col bg-[#0D1220] border-r border-[#1E2D4A]">
      {/* Logo */}
      <div className="p-5 border-b border-[#1E2D4A]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white font-[Syne,sans-serif] tracking-tight">
              股票分析
            </div>
            <div className="text-[10px] text-slate-500 tracking-widest uppercase">Platform</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="text-[10px] text-slate-600 uppercase tracking-widest px-3 mb-2">主菜单</div>
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                active
                  ? 'bg-blue-500/10 text-blue-400 border-l-2 border-blue-500 pl-2.5'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )}
            >
              <item.icon className={clsx('w-4 h-4 flex-shrink-0', active ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300')} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.label}</div>
                <div className="text-[11px] text-slate-600 group-hover:text-slate-500 truncate">{item.desc}</div>
              </div>
              {active && <ChevronRight className="w-3 h-3 text-blue-400" />}
            </Link>
          );
        })}
      </nav>

      {/* Market status */}
      <div className="p-4 border-t border-[#1E2D4A]">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>市场开盘中</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-600">美东 09:30 – 16:00</div>
      </div>
    </aside>
  );
}
