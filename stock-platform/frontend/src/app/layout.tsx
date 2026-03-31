import type { Metadata } from 'next';
import { Inter, Noto_Sans_SC } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const notoSansSC = Noto_Sans_SC({ subsets: ['latin'], variable: '--font-noto', weight: ['300', '400', '500', '700'] });

export const metadata: Metadata = {
  title: '股票分析平台 | 智能投研系统',
  description: '专业股票分析平台，提供实时行情、K线图、机构追踪、热力图、AI分析等功能',
  keywords: '股票分析,K线图,机构追踪,热力图,AI投研',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${notoSansSC.variable}`}>
      <body className="bg-[#0a0e1a] text-white min-h-screen font-sans antialiased">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <Navbar />
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1a2035', color: '#e2e8f0', border: '1px solid #2d3748' },
          }}
        />
      </body>
    </html>
  );
}
