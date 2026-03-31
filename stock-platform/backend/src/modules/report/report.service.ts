import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import pptxgen from 'pptxgenjs';
import { AiService } from '../ai/ai.service';

export type ReportFormat = 'md' | 'xlsx' | 'pptx';

export interface ReportData {
  symbol: string;
  nameZh?: string;
  price: number;
  changePercent: number;
  marketCap?: number;
  peRatio?: number;
  volume?: number;
  week52High?: number;
  week52Low?: number;
  sentiment?: { positive: number; neutral: number; negative: number };
  news?: Array<{ title: string; source: string; publishedAt: string }>;
  klineData?: Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }>;
  aiReport?: string;
}

@Injectable()
export class ReportService {
  private readonly outputDir: string;

  constructor(
    private configService: ConfigService,
    private aiService: AiService,
  ) {
    this.outputDir = configService.get('REPORT_OUTPUT_DIR', '/tmp/reports');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateReport(data: ReportData, format: ReportFormat): Promise<string> {
    // 如果没有AI报告，生成一个
    if (!data.aiReport) {
      data.aiReport = await this.aiService.generateReport({
        symbol: data.symbol,
        price: data.price,
        changePercent: data.changePercent,
        marketCap: data.marketCap || 0,
        peRatio: data.peRatio || 0,
        sentiment: data.sentiment || { positive: 33, neutral: 34, negative: 33 },
        newsCount: data.news?.length || 0,
      }).catch(() => '暂无AI分析');
    }

    switch (format) {
      case 'md':
        return this.generateMarkdown(data);
      case 'xlsx':
        return this.generateExcel(data);
      case 'pptx':
        return this.generatePPT(data);
      default:
        throw new Error(`不支持的格式: ${format}`);
    }
  }

  /**
   * 生成Markdown报告
   */
  private async generateMarkdown(data: ReportData): Promise<string> {
    const now = new Date().toLocaleDateString('zh-CN');
    const changeEmoji = data.changePercent >= 0 ? '📈' : '📉';
    const changeColor = data.changePercent >= 0 ? '+' : '';

    const md = `# ${data.symbol} ${data.nameZh || ''} 股票分析报告

> 生成时间：${now} | 数据来源：多平台聚合

---

## 📊 基础行情

| 指标 | 数值 |
|------|------|
| 当前价格 | $${data.price?.toFixed(2)} |
| 今日涨跌 | ${changeEmoji} ${changeColor}${data.changePercent?.toFixed(2)}% |
| 市值 | $${data.marketCap ? (data.marketCap / 1e9).toFixed(1) + 'B' : '暂无'} |
| 市盈率 | ${data.peRatio?.toFixed(2) || '暂无'} |
| 52周最高 | $${data.week52High?.toFixed(2) || '暂无'} |
| 52周最低 | $${data.week52Low?.toFixed(2) || '暂无'} |

---

## 🎭 市场情绪分析

\`\`\`
正面  ██████████████████ ${data.sentiment?.positive || 0}%
中性  ████████████       ${data.sentiment?.neutral || 0}%
负面  ██████             ${data.sentiment?.negative || 0}%
\`\`\`

---

## 📰 近期重要新闻

${data.news?.slice(0, 5).map((n, i) =>
  `${i + 1}. **${n.title}**  \n   来源：${n.source} | ${n.publishedAt}`
).join('\n\n') || '暂无新闻'}

---

## 🤖 AI智能分析

${data.aiReport || '暂无AI分析'}

---

## ⚠️ 风险提示

> 本报告仅供参考，不构成投资建议。股市有风险，投资需谨慎。

---
*由股票分析平台自动生成*
`;

    const fileName = `${data.symbol}_report_${Date.now()}.md`;
    const filePath = path.join(this.outputDir, fileName);
    fs.writeFileSync(filePath, md, 'utf-8');
    return filePath;
  }

  /**
   * 生成Excel报告（高级设计）
   */
  private async generateExcel(data: ReportData): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '股票分析平台';
    workbook.created = new Date();

    // ===== Sheet1: 基础行情 =====
    const sheet1 = workbook.addWorksheet('基础行情', {
      properties: { tabColor: { argb: '1a1a2e' } },
    });

    // 设置列宽
    sheet1.columns = [
      { width: 20 }, { width: 25 }, { width: 20 }, { width: 25 },
    ];

    // 标题行
    sheet1.mergeCells('A1:D1');
    const titleCell = sheet1.getCell('A1');
    titleCell.value = `${data.symbol} ${data.nameZh || ''} - 股票分析报告`;
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1a1a2e' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet1.getRow(1).height = 40;

    // 数据行
    const metrics = [
      ['当前价格', `$${data.price?.toFixed(2)}`, '52周最高', `$${data.week52High?.toFixed(2) || 'N/A'}`],
      ['今日涨跌', `${data.changePercent >= 0 ? '+' : ''}${data.changePercent?.toFixed(2)}%`, '52周最低', `$${data.week52Low?.toFixed(2) || 'N/A'}`],
      ['市值', `$${data.marketCap ? (data.marketCap / 1e9).toFixed(1) + 'B' : 'N/A'}`, '市盈率', data.peRatio?.toFixed(2) || 'N/A'],
      ['成交量', data.volume?.toLocaleString() || 'N/A', '情绪指数', `正${data.sentiment?.positive || 0}% 负${data.sentiment?.negative || 0}%`],
    ];

    metrics.forEach((row, i) => {
      const rowNum = i + 3;
      sheet1.getRow(rowNum).height = 30;
      row.forEach((val, j) => {
        const cell = sheet1.getCell(rowNum, j + 1);
        cell.value = val;
        if (j % 2 === 0) {
          // 标签列
          cell.font = { bold: true, color: { argb: '64748b' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'f8fafc' } };
        } else {
          // 数值列
          cell.font = { bold: true, size: 12 };
          if (j === 1 && i === 1) {
            // 涨跌幅着色
            cell.font.color = { argb: data.changePercent >= 0 ? '16a34a' : 'dc2626' };
          }
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'e2e8f0' } },
        };
      });
    });

    // ===== Sheet2: AI分析报告 =====
    const sheet2 = workbook.addWorksheet('AI分析');
    sheet2.columns = [{ width: 100 }];

    sheet2.mergeCells('A1:A1');
    const aiTitle = sheet2.getCell('A1');
    aiTitle.value = 'AI智能分析报告';
    aiTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
    aiTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '7c3aed' } };
    aiTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet2.getRow(1).height = 35;

    const aiContent = sheet2.getCell('A2');
    aiContent.value = data.aiReport || '暂无AI分析';
    aiContent.alignment = { wrapText: true, vertical: 'top' };
    aiContent.font = { size: 11 };
    sheet2.getRow(2).height = 200;

    // ===== Sheet3: 新闻列表 =====
    const sheet3 = workbook.addWorksheet('近期新闻');
    sheet3.columns = [
      { header: '标题', width: 60 },
      { header: '来源', width: 20 },
      { header: '发布时间', width: 20 },
    ];

    // 表头样式
    sheet3.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0f172a' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    data.news?.forEach((n, i) => {
      const row = sheet3.addRow([n.title, n.source, n.publishedAt]);
      row.height = 25;
      if (i % 2 === 0) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'f8fafc' } };
        });
      }
    });

    const fileName = `${data.symbol}_report_${Date.now()}.xlsx`;
    const filePath = path.join(this.outputDir, fileName);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  /**
   * 生成PPT报告（高级设计）
   */
  private async generatePPT(data: ReportData): Promise<string> {
    const prs = new pptxgen();

    // 主题颜色
    const DARK = '0f172a';
    const BLUE = '3b82f6';
    const GREEN = '16a34a';
    const RED = 'dc2626';
    const PURPLE = '7c3aed';
    const LIGHT = 'f8fafc';

    prs.layout = 'LAYOUT_WIDE';

    // ===== 封面页 =====
    const slide1 = prs.addSlide();
    slide1.background = { color: DARK };

    // 装饰圆圈
    slide1.addShape(prs.ShapeType.ellipse, {
      x: 8, y: -1, w: 4, h: 4,
      fill: { color: BLUE, transparency: 80 },
      line: { color: BLUE, transparency: 80 },
    });
    slide1.addShape(prs.ShapeType.ellipse, {
      x: -1, y: 5, w: 3, h: 3,
      fill: { color: PURPLE, transparency: 80 },
      line: { color: PURPLE, transparency: 80 },
    });

    slide1.addText('股票分析报告', {
      x: 0.5, y: 1.5, w: 9, h: 0.8,
      fontSize: 14, color: '94a3b8', bold: false,
      align: 'center',
    });

    slide1.addText(`${data.symbol}`, {
      x: 0.5, y: 2.2, w: 9, h: 1.5,
      fontSize: 56, color: BLUE, bold: true,
      align: 'center',
    });

    if (data.nameZh) {
      slide1.addText(data.nameZh, {
        x: 0.5, y: 3.6, w: 9, h: 0.6,
        fontSize: 22, color: 'e2e8f0', bold: false,
        align: 'center',
      });
    }

    slide1.addText(`$${data.price?.toFixed(2)}`, {
      x: 3, y: 4.4, w: 4, h: 0.8,
      fontSize: 32, color: data.changePercent >= 0 ? GREEN : RED,
      bold: true, align: 'center',
    });

    slide1.addText(`${data.changePercent >= 0 ? '▲' : '▼'} ${Math.abs(data.changePercent || 0).toFixed(2)}%`, {
      x: 3, y: 5.0, w: 4, h: 0.5,
      fontSize: 18, color: data.changePercent >= 0 ? GREEN : RED,
      align: 'center',
    });

    slide1.addText(`生成时间：${new Date().toLocaleDateString('zh-CN')}`, {
      x: 0.5, y: 6.8, w: 9, h: 0.4,
      fontSize: 11, color: '64748b', align: 'center',
    });

    // ===== 基础数据页 =====
    const slide2 = prs.addSlide();
    slide2.background = { color: '0a0e1a' };

    slide2.addText('📊 基础数据', {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: 22, color: BLUE, bold: true,
    });

    // 数据卡片
    const cards = [
      { label: '市值', value: data.marketCap ? `$${(data.marketCap / 1e9).toFixed(1)}B` : 'N/A', color: BLUE },
      { label: '市盈率', value: data.peRatio?.toFixed(2) || 'N/A', color: PURPLE },
      { label: '52周高', value: `$${data.week52High?.toFixed(2) || 'N/A'}`, color: GREEN },
      { label: '52周低', value: `$${data.week52Low?.toFixed(2) || 'N/A'}`, color: RED },
    ];

    cards.forEach((card, i) => {
      const x = 0.4 + (i % 2) * 5;
      const y = 1.2 + Math.floor(i / 2) * 2.2;

      slide2.addShape(prs.ShapeType.roundRect, {
        x, y, w: 4.5, h: 1.9,
        fill: { color: '1a1a2e' },
        line: { color: card.color, pt: 1 },
        rectRadius: 0.1,
      });

      slide2.addText(card.label, {
        x: x + 0.2, y: y + 0.2, w: 4, h: 0.4,
        fontSize: 13, color: '94a3b8',
      });

      slide2.addText(card.value, {
        x: x + 0.2, y: y + 0.7, w: 4, h: 0.8,
        fontSize: 28, color: card.color, bold: true,
      });
    });

    // ===== 情绪分析页 =====
    const slide3 = prs.addSlide();
    slide3.background = { color: '0a0e1a' };

    slide3.addText('🎭 市场情绪分析', {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: 22, color: BLUE, bold: true,
    });

    const sentiments = [
      { label: '正面情绪', value: data.sentiment?.positive || 0, color: GREEN },
      { label: '中性情绪', value: data.sentiment?.neutral || 0, color: '64748b' },
      { label: '负面情绪', value: data.sentiment?.negative || 0, color: RED },
    ];

    sentiments.forEach((s, i) => {
      const y = 1.5 + i * 1.5;
      slide3.addText(s.label, {
        x: 0.5, y, w: 2, h: 0.5,
        fontSize: 14, color: 'e2e8f0',
      });
      slide3.addText(`${s.value}%`, {
        x: 8.5, y, w: 1, h: 0.5,
        fontSize: 14, color: s.color, bold: true, align: 'right',
      });

      // 进度条背景
      slide3.addShape(prs.ShapeType.rect, {
        x: 2.5, y: y + 0.05, w: 6, h: 0.3,
        fill: { color: '1e293b' }, line: { color: '1e293b' },
      });
      // 进度条
      slide3.addShape(prs.ShapeType.rect, {
        x: 2.5, y: y + 0.05, w: Math.max(0.1, 6 * s.value / 100), h: 0.3,
        fill: { color: s.color }, line: { color: s.color },
      });
    });

    // ===== AI分析页 =====
    const slide4 = prs.addSlide();
    slide4.background = { color: '0a0e1a' };

    slide4.addShape(prs.ShapeType.rect, {
      x: 0, y: 0, w: 10, h: 1,
      fill: { color: PURPLE }, line: { color: PURPLE },
    });

    slide4.addText('🤖 AI智能分析', {
      x: 0.5, y: 0.2, w: 9, h: 0.6,
      fontSize: 22, color: 'FFFFFF', bold: true,
    });

    slide4.addText(data.aiReport || '暂无AI分析', {
      x: 0.5, y: 1.2, w: 9, h: 5.5,
      fontSize: 13, color: 'e2e8f0',
      align: 'left', valign: 'top',
      wrap: true,
    });

    // ===== 新闻页 =====
    if (data.news && data.news.length > 0) {
      const slide5 = prs.addSlide();
      slide5.background = { color: '0a0e1a' };

      slide5.addText('📰 近期重要新闻', {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 22, color: BLUE, bold: true,
      });

      data.news.slice(0, 5).forEach((n, i) => {
        const y = 1.2 + i * 1.1;
        slide5.addShape(prs.ShapeType.rect, {
          x: 0.4, y, w: 9.2, h: 0.9,
          fill: { color: '1a1a2e' }, line: { color: '1e293b' },
        });
        slide5.addText(`${i + 1}. ${n.title}`, {
          x: 0.6, y: y + 0.05, w: 8.5, h: 0.5,
          fontSize: 12, color: 'e2e8f0', bold: false,
          wrap: true,
        });
        slide5.addText(`${n.source}  ${n.publishedAt}`, {
          x: 0.6, y: y + 0.5, w: 8.5, h: 0.3,
          fontSize: 10, color: '64748b',
        });
      });
    }

    // ===== 免责声明页 =====
    const slide6 = prs.addSlide();
    slide6.background = { color: DARK };

    slide6.addText('⚠️ 风险提示', {
      x: 0.5, y: 2, w: 9, h: 0.8,
      fontSize: 28, color: 'f59e0b', bold: true, align: 'center',
    });

    slide6.addText(
      '本报告仅供参考，不构成任何投资建议。\n股市有风险，投资需谨慎。\n请根据自身风险承受能力做出投资决策。',
      {
        x: 1, y: 3, w: 8, h: 2,
        fontSize: 16, color: '94a3b8', align: 'center',
        lineSpacingMultiple: 1.8,
      },
    );

    slide6.addText('由股票分析平台自动生成', {
      x: 0.5, y: 6.3, w: 9, h: 0.4,
      fontSize: 11, color: '475569', align: 'center',
    });

    const fileName = `${data.symbol}_report_${Date.now()}.pptx`;
    const filePath = path.join(this.outputDir, fileName);
    await prs.writeFile({ fileName: filePath });
    return filePath;
  }
}
