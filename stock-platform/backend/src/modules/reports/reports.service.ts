import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as PptxGenJS from 'pptxgenjs';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly outputDir = path.join(process.cwd(), 'reports');

  constructor(private readonly dataSource: DataSource) {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // ============================================================
  // 主入口：生成报告
  // ============================================================
  async generateReport(symbol: string, format: string): Promise<string> {
    if (!['md', 'xlsx', 'pptx', 'pdf'].includes(format)) {
      throw new BadRequestException(`不支持的格式: ${format}`);
    }

    const data = await this.gatherStockData(symbol);
    const fileName = `${symbol}_report_${Date.now()}.${format}`;
    const filePath = path.join(this.outputDir, fileName);

    switch (format) {
      case 'md':
        await this.generateMarkdown(data, filePath);
        break;
      case 'xlsx':
        await this.generateExcel(data, filePath);
        break;
      case 'pptx':
        await this.generatePPT(data, filePath);
        break;
    }

    this.logger.log(`报告生成成功: ${filePath}`);
    return filePath;
  }

  // ============================================================
  // 聚合股票数据
  // ============================================================
  private async gatherStockData(symbol: string): Promise<any> {
    const sym = symbol.toUpperCase();

    const [stock, quote, klines, news, sentiment, financials] = await Promise.allSettled([
      this.dataSource.query(`SELECT * FROM stocks WHERE symbol=$1`, [sym]),
      this.dataSource.query(
        `SELECT * FROM quotes WHERE symbol=$1 ORDER BY quoted_at DESC LIMIT 1`, [sym],
      ),
      this.dataSource.query(
        `SELECT * FROM klines WHERE symbol=$1 AND period='1d' ORDER BY open_time DESC LIMIT 30`, [sym],
      ),
      this.dataSource.query(
        `SELECT title, source, published_at, sentiment FROM news WHERE symbol=$1 ORDER BY published_at DESC LIMIT 10`, [sym],
      ),
      this.dataSource.query(
        `SELECT * FROM sentiment_summary WHERE symbol=$1 ORDER BY date DESC LIMIT 1`, [sym],
      ),
      this.dataSource.query(
        `SELECT * FROM financials WHERE symbol=$1 AND period_type='annual' ORDER BY period DESC LIMIT 4`, [sym],
      ),
    ]);

    return {
      symbol: sym,
      stock: (stock as any).value?.[0] || {},
      quote: (quote as any).value?.[0] || {},
      klines: (klines as any).value || [],
      news: (news as any).value || [],
      sentiment: (sentiment as any).value?.[0] || {},
      financials: (financials as any).value || [],
      generatedAt: new Date().toISOString(),
    };
  }

  // ============================================================
  // Markdown报告生成
  // ============================================================
  private async generateMarkdown(data: any, filePath: string): Promise<void> {
    const { symbol, stock, quote, klines, news, sentiment, financials } = data;

    const changePct = quote.change_pct ? (+quote.change_pct).toFixed(2) : 'N/A';
    const direction = +quote.change_pct > 0 ? '📈' : '📉';

    const md = `# ${symbol} 股票分析报告
> 生成时间：${new Date(data.generatedAt).toLocaleString('zh-CN')}

---

## 📊 基础信息

| 字段 | 数值 |
|------|------|
| 股票代码 | **${symbol}** |
| 公司名称 | ${stock.name_zh || stock.name_en || 'N/A'} |
| 交易所 | ${stock.exchange || 'N/A'} |
| 行业 | ${stock.sector || 'N/A'} |
| 国家 | ${stock.country || 'N/A'} |

---

## 💰 实时行情

| 字段 | 数值 |
|------|------|
| 当前价格 | **$${(+quote.price || 0).toFixed(2)}** ${direction} |
| 涨跌幅 | ${changePct}% |
| 今日开盘 | $${(+quote.open || 0).toFixed(2)} |
| 今日最高 | $${(+quote.high || 0).toFixed(2)} |
| 今日最低 | $${(+quote.low || 0).toFixed(2)} |
| 成交量 | ${(+quote.volume || 0).toLocaleString()} |
| 市值 | $${((+quote.market_cap || 0) / 1e9).toFixed(2)}B |
| 市盈率 | ${(+quote.pe_ratio || 0).toFixed(2)} |
| 52周高点 | $${(+quote.week_52_high || 0).toFixed(2)} |
| 52周低点 | $${(+quote.week_52_low || 0).toFixed(2)} |

---

## 📈 K线趋势分析（近30日）

${klines.length > 0 ? `
- **最新收盘价**：$${(+klines[0]?.close || 0).toFixed(2)}
- **30日最高**：$${Math.max(...klines.map((k: any) => +k.high)).toFixed(2)}
- **30日最低**：$${Math.min(...klines.map((k: any) => +k.low)).toFixed(2)}
- **30日均价**：$${(klines.reduce((a: number, k: any) => a + +k.close, 0) / klines.length).toFixed(2)}
- **30日成交量**：${klines.reduce((a: number, k: any) => a + +k.volume, 0).toLocaleString()}
` : '> 暂无K线数据'}

---

## 🏦 财务数据

${financials.length > 0 ? `
| 年度 | 营收(B) | 净利润(B) | EPS | ROE |
|------|---------|-----------|-----|-----|
${financials.map((f: any) => `| ${f.period} | $${((+f.revenue || 0) / 1e9).toFixed(2)} | $${((+f.net_income || 0) / 1e9).toFixed(2)} | $${(+f.eps || 0).toFixed(2)} | ${((+f.roe || 0) * 100).toFixed(1)}% |`).join('\n')}
` : '> 暂无财务数据'}

---

## 📰 最新新闻

${news.map((n: any, i: number) => `${i + 1}. **${n.title}**
   - 来源：${n.source || 'Unknown'} | 情绪：${n.sentiment || '中性'} | ${new Date(n.published_at).toLocaleDateString('zh-CN')}`).join('\n\n') || '> 暂无新闻'}

---

## 🎭 市场情绪分析

| 维度 | 数值 |
|------|------|
| 积极情绪 | ${sentiment.positive_pct || 0}% |
| 中性情绪 | ${sentiment.neutral_pct || 0}% |
| 消极情绪 | ${sentiment.negative_pct || 0}% |
| 分析样本数 | ${sentiment.total_count || 0} |
| 数据日期 | ${sentiment.date || 'N/A'} |

---

## 🤖 AI投资建议

> ⚠️ 以下分析仅供参考，不构成投资建议。

基于以上数据，**${stock.name_zh || symbol}** ${+changePct > 0 ? '近期表现强势，市场情绪偏积极' : '近期承压，市场情绪较为谨慎'}。

投资者应综合考虑：
- 公司基本面数据（财务状况、盈利能力）
- 行业竞争格局与宏观环境
- 个人风险承受能力

---

*报告由股票分析平台自动生成 | ${new Date().toLocaleString('zh-CN')}*
`;

    fs.writeFileSync(filePath, md, 'utf-8');
  }

  // ============================================================
  // Excel报告生成（高级样式）
  // ============================================================
  private async generateExcel(data: any, filePath: string): Promise<void> {
    const { symbol, stock, quote, klines, news, sentiment, financials } = data;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '股票分析平台';
    workbook.created = new Date();

    // --------- Sheet 1: 概览 ---------
    const overviewSheet = workbook.addWorksheet('📊 股票概览', {
      properties: { tabColor: { argb: '1E3A8A' } },
    });

    overviewSheet.columns = [
      { header: '字段', key: 'field', width: 20 },
      { header: '数值', key: 'value', width: 30 },
    ];

    // 设置标题行样式
    overviewSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 };
    overviewSheet.getRow(1).fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' },
    };

    const overviewData = [
      { field: '股票代码', value: symbol },
      { field: '公司名称', value: stock.name_zh || stock.name_en },
      { field: '交易所', value: stock.exchange },
      { field: '行业', value: stock.sector },
      { field: '当前价格', value: `$${(+quote.price || 0).toFixed(2)}` },
      { field: '涨跌幅', value: `${(+quote.change_pct || 0).toFixed(2)}%` },
      { field: '市值', value: `$${((+quote.market_cap || 0) / 1e9).toFixed(2)}B` },
      { field: '市盈率', value: `${(+quote.pe_ratio || 0).toFixed(2)}` },
      { field: '成交量', value: (+quote.volume || 0).toLocaleString() },
      { field: '52周最高', value: `$${(+quote.week_52_high || 0).toFixed(2)}` },
      { field: '52周最低', value: `$${(+quote.week_52_low || 0).toFixed(2)}` },
    ];
    overviewData.forEach((row, idx) => {
      overviewSheet.addRow(row);
      if (idx % 2 === 0) {
        overviewSheet.lastRow!.fill = {
          type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0F4FF' },
        };
      }
    });

    // --------- Sheet 2: K线数据 ---------
    const klineSheet = workbook.addWorksheet('📈 K线数据', {
      properties: { tabColor: { argb: '16A34A' } },
    });
    klineSheet.columns = [
      { header: '日期', key: 'date', width: 15 },
      { header: '开盘', key: 'open', width: 12 },
      { header: '最高', key: 'high', width: 12 },
      { header: '最低', key: 'low', width: 12 },
      { header: '收盘', key: 'close', width: 12 },
      { header: '成交量', key: 'volume', width: 18 },
    ];
    klineSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    klineSheet.getRow(1).fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: '16A34A' },
    };

    klines.forEach((k: any, i: number) => {
      const row = klineSheet.addRow({
        date: new Date(k.open_time).toLocaleDateString('zh-CN'),
        open: (+k.open).toFixed(2),
        high: (+k.high).toFixed(2),
        low: (+k.low).toFixed(2),
        close: (+k.close).toFixed(2),
        volume: +k.volume,
      });
      if (+k.close >= +k.open) {
        row.getCell('close').font = { color: { argb: 'DC2626' } };
      } else {
        row.getCell('close').font = { color: { argb: '16A34A' } };
      }
    });

    // --------- Sheet 3: 财务数据 ---------
    const finSheet = workbook.addWorksheet('🏦 财务数据', {
      properties: { tabColor: { argb: 'D97706' } },
    });
    finSheet.columns = [
      { header: '年度', key: 'period', width: 10 },
      { header: '营收(亿$)', key: 'revenue', width: 14 },
      { header: '净利润(亿$)', key: 'netIncome', width: 16 },
      { header: 'EPS($)', key: 'eps', width: 12 },
      { header: 'ROE(%)', key: 'roe', width: 12 },
    ];
    finSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    finSheet.getRow(1).fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: 'D97706' },
    };
    financials.forEach((f: any) => {
      finSheet.addRow({
        period: f.period,
        revenue: ((+f.revenue || 0) / 1e8).toFixed(2),
        netIncome: ((+f.net_income || 0) / 1e8).toFixed(2),
        eps: (+f.eps || 0).toFixed(2),
        roe: ((+f.roe || 0) * 100).toFixed(1),
      });
    });

    // --------- Sheet 4: 新闻 ---------
    const newsSheet = workbook.addWorksheet('📰 最新新闻', {
      properties: { tabColor: { argb: '7C3AED' } },
    });
    newsSheet.columns = [
      { header: '标题', key: 'title', width: 60 },
      { header: '来源', key: 'source', width: 20 },
      { header: '情绪', key: 'sentiment', width: 12 },
      { header: '发布时间', key: 'date', width: 18 },
    ];
    newsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    newsSheet.getRow(1).fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: '7C3AED' },
    };
    news.forEach((n: any) => {
      newsSheet.addRow({
        title: n.title,
        source: n.source,
        sentiment: n.sentiment,
        date: new Date(n.published_at).toLocaleDateString('zh-CN'),
      });
    });

    await workbook.xlsx.writeFile(filePath);
  }

  // ============================================================
  // PPTX报告生成（高级设计）
  // ============================================================
  private async generatePPT(data: any, filePath: string): Promise<void> {
    const { symbol, stock, quote, klines, news, sentiment, financials } = data;
    const prs = new PptxGenJS();

    // 主题颜色
    const theme = {
      primary: '1E3A8A',
      accent: '3B82F6',
      success: '10B981',
      danger: 'EF4444',
      dark: '0F172A',
      light: 'F8FAFC',
      gray: '64748B',
    };

    prs.layout = 'LAYOUT_WIDE';
    prs.author = '股票分析平台';
    prs.subject = `${symbol} 股票分析报告`;

    // ===== Slide 1: 封面 =====
    const slide1 = prs.addSlide();
    slide1.background = { color: theme.dark };

    slide1.addShape(prs.ShapeType.rect, {
      x: 0, y: 0, w: '40%', h: '100%', fill: { color: theme.primary },
    });

    slide1.addText(symbol, {
      x: '5%', y: '25%', w: '35%', fontSize: 64, bold: true,
      color: 'FFFFFF', align: 'center',
    });
    slide1.addText(stock.name_zh || stock.name_en || symbol, {
      x: '5%', y: '50%', w: '35%', fontSize: 18,
      color: 'A0B4D0', align: 'center',
    });
    slide1.addText('股票分析报告', {
      x: '45%', y: '35%', w: '50%', fontSize: 36, bold: true,
      color: 'FFFFFF',
    });
    slide1.addText(`生成时间：${new Date().toLocaleDateString('zh-CN')}`, {
      x: '45%', y: '50%', w: '50%', fontSize: 16,
      color: theme.gray,
    });
    slide1.addText(`交易所：${stock.exchange || 'N/A'} | 行业：${stock.sector || 'N/A'}`, {
      x: '45%', y: '58%', w: '50%', fontSize: 14,
      color: theme.gray,
    });

    // ===== Slide 2: 实时行情 =====
    const slide2 = prs.addSlide();
    slide2.background = { color: theme.light };

    slide2.addText('实时行情', {
      x: '5%', y: '5%', w: '90%', fontSize: 28, bold: true,
      color: theme.dark,
    });
    slide2.addShape(prs.ShapeType.rect, {
      x: '5%', y: '13%', w: '90%', h: 0.04, fill: { color: theme.primary },
    });

    const isPositive = +quote.change_pct > 0;
    slide2.addText(`$${(+quote.price || 0).toFixed(2)}`, {
      x: '5%', y: '20%', w: '40%', fontSize: 54, bold: true,
      color: isPositive ? theme.success : theme.danger,
    });
    slide2.addText(`${isPositive ? '▲' : '▼'} ${Math.abs(+quote.change_pct || 0).toFixed(2)}%`, {
      x: '5%', y: '42%', w: '40%', fontSize: 24, bold: true,
      color: isPositive ? theme.success : theme.danger,
    });

    const metrics = [
      ['开盘价', `$${(+quote.open || 0).toFixed(2)}`],
      ['最高价', `$${(+quote.high || 0).toFixed(2)}`],
      ['最低价', `$${(+quote.low || 0).toFixed(2)}`],
      ['成交量', `${((+quote.volume || 0) / 1e6).toFixed(1)}M`],
      ['市值', `$${((+quote.market_cap || 0) / 1e9).toFixed(1)}B`],
      ['市盈率', `${(+quote.pe_ratio || 0).toFixed(1)}x`],
    ];

    metrics.forEach(([label, value], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      slide2.addShape(prs.ShapeType.rect, {
        x: `${50 + col * 17}%`, y: `${22 + row * 28}%`, w: '15%', h: '25%',
        fill: { color: 'FFFFFF' }, line: { color: 'E2E8F0', width: 1 },
      });
      slide2.addText(label, {
        x: `${50 + col * 17}%`, y: `${24 + row * 28}%`, w: '15%',
        fontSize: 11, color: theme.gray, align: 'center',
      });
      slide2.addText(value, {
        x: `${50 + col * 17}%`, y: `${32 + row * 28}%`, w: '15%',
        fontSize: 16, bold: true, color: theme.dark, align: 'center',
      });
    });

    // ===== Slide 3: 市场情绪 =====
    const slide3 = prs.addSlide();
    slide3.background = { color: theme.light };

    slide3.addText('市场情绪分析', {
      x: '5%', y: '5%', w: '90%', fontSize: 28, bold: true, color: theme.dark,
    });
    slide3.addShape(prs.ShapeType.rect, {
      x: '5%', y: '13%', w: '90%', h: 0.04, fill: { color: theme.primary },
    });

    const sentimentData = [
      { label: '积极', pct: +sentiment.positive_pct || 33, color: theme.success },
      { label: '中性', pct: +sentiment.neutral_pct || 34, color: theme.accent },
      { label: '消极', pct: +sentiment.negative_pct || 33, color: theme.danger },
    ];

    sentimentData.forEach((s, i) => {
      slide3.addShape(prs.ShapeType.rect, {
        x: `${15 + i * 28}%`, y: '20%', w: '22%', h: '50%',
        fill: { color: s.color + '20' }, line: { color: s.color, width: 2 },
      });
      slide3.addText(`${s.pct}%`, {
        x: `${15 + i * 28}%`, y: '30%', w: '22%',
        fontSize: 36, bold: true, color: s.color, align: 'center',
      });
      slide3.addText(s.label, {
        x: `${15 + i * 28}%`, y: '52%', w: '22%',
        fontSize: 18, color: theme.dark, align: 'center',
      });
    });

    slide3.addText(`数据样本：${sentiment.total_count || 0} 条`, {
      x: '5%', y: '78%', w: '90%', fontSize: 14, color: theme.gray, align: 'center',
    });

    // ===== Slide 4: 新闻摘要 =====
    const slide4 = prs.addSlide();
    slide4.background = { color: theme.light };
    slide4.addText('最新新闻动态', {
      x: '5%', y: '5%', w: '90%', fontSize: 28, bold: true, color: theme.dark,
    });
    slide4.addShape(prs.ShapeType.rect, {
      x: '5%', y: '13%', w: '90%', h: 0.04, fill: { color: theme.primary },
    });

    news.slice(0, 5).forEach((n: any, i: number) => {
      const sentColor = n.sentiment === 'positive' ? theme.success :
                        n.sentiment === 'negative' ? theme.danger : theme.gray;
      slide4.addShape(prs.ShapeType.rect, {
        x: '5%', y: `${17 + i * 16}%`, w: '3%', h: '10%',
        fill: { color: sentColor },
      });
      slide4.addText(n.title, {
        x: '10%', y: `${17 + i * 16}%`, w: '82%', fontSize: 13,
        color: theme.dark, bold: true,
      });
      slide4.addText(`${n.source} | ${new Date(n.published_at).toLocaleDateString('zh-CN')}`, {
        x: '10%', y: `${21 + i * 16}%`, w: '82%', fontSize: 11,
        color: theme.gray,
      });
    });

    // ===== Slide 5: 财务摘要 =====
    if (financials.length > 0) {
      const slide5 = prs.addSlide();
      slide5.background = { color: theme.light };
      slide5.addText('财务数据概览', {
        x: '5%', y: '5%', w: '90%', fontSize: 28, bold: true, color: theme.dark,
      });
      slide5.addShape(prs.ShapeType.rect, {
        x: '5%', y: '13%', w: '90%', h: 0.04, fill: { color: theme.primary },
      });

      // 财务表格
      const tableData = [
        [
          { text: '年度', options: { bold: true, fill: { color: theme.primary }, color: 'FFFFFF' } },
          { text: '营收(亿$)', options: { bold: true, fill: { color: theme.primary }, color: 'FFFFFF' } },
          { text: '净利润(亿$)', options: { bold: true, fill: { color: theme.primary }, color: 'FFFFFF' } },
          { text: 'EPS($)', options: { bold: true, fill: { color: theme.primary }, color: 'FFFFFF' } },
          { text: 'ROE', options: { bold: true, fill: { color: theme.primary }, color: 'FFFFFF' } },
        ],
        ...financials.map((f: any) => [
          { text: f.period || '' },
          { text: `$${((+f.revenue || 0) / 1e8).toFixed(1)}` },
          { text: `$${((+f.net_income || 0) / 1e8).toFixed(1)}` },
          { text: `$${(+f.eps || 0).toFixed(2)}` },
          { text: `${((+f.roe || 0) * 100).toFixed(1)}%` },
        ]),
      ];

      slide5.addTable(tableData, {
        x: '5%', y: '20%', w: '90%',
        rowH: 0.5,
        fontSize: 14,
        align: 'center',
        border: { pt: 0.5, color: 'E2E8F0' },
      });
    }

    // ===== Slide 6: 免责声明 =====
    const slideEnd = prs.addSlide();
    slideEnd.background = { color: theme.dark };
    slideEnd.addText('免责声明', {
      x: '10%', y: '25%', w: '80%', fontSize: 32, bold: true, color: 'FFFFFF', align: 'center',
    });
    slideEnd.addText(
      '本报告由股票分析平台自动生成，所有数据仅供参考，不构成任何投资建议。\n投资有风险，入市需谨慎。请在做出任何投资决策前，咨询专业财务顾问。',
      {
        x: '10%', y: '45%', w: '80%', fontSize: 16, color: theme.gray,
        align: 'center',
      },
    );
    slideEnd.addText(`股票分析平台 © ${new Date().getFullYear()}`, {
      x: '10%', y: '75%', w: '80%', fontSize: 14, color: '4B5563', align: 'center',
    });

    await prs.writeFile({ fileName: filePath });
  }
}
