// sentiment.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios from 'axios';

@Injectable()
export class SentimentService {
  private readonly logger = new Logger(SentimentService.name);
  private readonly aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getSentiment(symbol: string): Promise<any> {
    const cacheKey = `sentiment:${symbol}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const sym = symbol.toUpperCase();

    // 1. Latest from DB
    const [summary] = await this.ds.query(
      `SELECT * FROM sentiment_summary WHERE symbol=$1 ORDER BY date DESC LIMIT 1`,
      [sym],
    );

    if (summary) {
      const result = {
        symbol: sym,
        positive: +summary.positive_pct || 0,
        neutral: +summary.neutral_pct || 0,
        negative: +summary.negative_pct || 0,
        total: +summary.total_count || 0,
        date: summary.date,
        source: summary.data_source,
      };
      await this.cache.set(cacheKey, result, 300);
      return result;
    }

    // 2. Compute from recent news
    const recentNews = await this.ds.query(
      `SELECT sentiment FROM news WHERE symbol=$1 AND sentiment IS NOT NULL
       AND published_at > NOW() - INTERVAL '7 days' LIMIT 100`,
      [sym],
    );

    if (recentNews.length > 0) {
      const counts = { positive: 0, neutral: 0, negative: 0 };
      recentNews.forEach((n: any) => {
        if (counts[n.sentiment as keyof typeof counts] !== undefined)
          counts[n.sentiment as keyof typeof counts]++;
      });
      const total = recentNews.length;
      const result = {
        symbol: sym,
        positive: Math.round((counts.positive / total) * 100),
        neutral: Math.round((counts.neutral / total) * 100),
        negative: Math.round((counts.negative / total) * 100),
        total,
        source: 'news',
      };
      await this.cache.set(cacheKey, result, 300);
      return result;
    }

    // 3. Default neutral
    const fallback = { symbol: sym, positive: 40, neutral: 35, negative: 25, total: 0, source: 'default' };
    await this.cache.set(cacheKey, fallback, 60);
    return fallback;
  }

  async analyzeSentiment(symbol: string, texts: string[]): Promise<any> {
    try {
      const res = await axios.post(`${this.aiUrl}/sentiment`, { symbol, texts }, { timeout: 30000 });
      return res.data;
    } catch {
      return { positive: 40, neutral: 35, negative: 25 };
    }
  }
}

// sentiment.controller.ts
import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('sentiment')
@Controller('sentiment')
export class SentimentController {
  constructor(private readonly sentimentService: SentimentService) {}

  @Get(':symbol')
  @ApiOperation({ summary: '获取情绪分析' })
  async getSentiment(@Param('symbol') symbol: string) {
    const data = await this.sentimentService.getSentiment(symbol.toUpperCase());
    return { data };
  }

  @Post('analyze')
  @ApiOperation({ summary: 'AI情绪分析' })
  async analyze(@Body() body: { symbol: string; texts: string[] }) {
    const data = await this.sentimentService.analyzeSentiment(body.symbol, body.texts);
    return { data };
  }
}

// sentiment.module.ts
import { Module } from '@nestjs/common';

@Module({
  controllers: [SentimentController],
  providers: [SentimentService],
  exports: [SentimentService],
})
export class SentimentModule {}
