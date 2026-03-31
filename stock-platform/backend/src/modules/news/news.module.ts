// news.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios from 'axios';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  private readonly scraperUrl = process.env.SCRAPER_URL || 'http://localhost:8000';

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getNews(symbol: string, page = 1, limit = 20): Promise<any> {
    const cacheKey = `news:${symbol}:${page}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const offset = (page - 1) * limit;
    const sym = symbol.toUpperCase();

    // 1. Try database
    const [rows, countRes] = await Promise.all([
      this.ds.query(
        `SELECT id, title, summary, source, source_url, image_url, language, sentiment, published_at
         FROM news WHERE symbol=$1 ORDER BY published_at DESC LIMIT $2 OFFSET $3`,
        [sym, limit, offset],
      ),
      this.ds.query(`SELECT COUNT(*) FROM news WHERE symbol=$1`, [sym]),
    ]);

    if (rows.length > 0) {
      const result = { data: rows, total: +countRes[0].count, page, pageSize: limit };
      await this.cache.set(cacheKey, result, 120);
      return result;
    }

    // 2. Fallback to scraper
    try {
      const res = await axios.get(`${this.scraperUrl}/news/${sym}`, {
        params: { page, limit },
        timeout: 10000,
      });
      const scraperData = res.data?.data || [];
      // Async save to DB
      this.saveNews(sym, scraperData).catch(() => {});
      const result = { data: scraperData, total: scraperData.length, page, pageSize: limit };
      await this.cache.set(cacheKey, result, 120);
      return result;
    } catch (err) {
      this.logger.warn(`News scraper failed for ${sym}: ${err.message}`);
      return { data: [], total: 0, page, pageSize: limit };
    }
  }

  private async saveNews(symbol: string, newsItems: any[]) {
    for (const item of newsItems) {
      try {
        await this.ds.query(
          `INSERT INTO news (symbol, title, summary, source, source_url, language, published_at, content_hash)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (content_hash) DO NOTHING`,
          [symbol, item.title, item.summary, item.source, item.source_url,
           item.language || 'en', item.published_at,
           require('crypto').createHash('md5').update(item.title || '').digest('hex')],
        );
      } catch { /* ignore duplicate */ }
    }
  }
}

// news.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get(':symbol')
  @ApiOperation({ summary: '获取股票新闻' })
  @ApiParam({ name: 'symbol', example: 'NVDA' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async getNews(
    @Param('symbol') symbol: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.newsService.getNews(symbol.toUpperCase(), +page, +limit);
  }
}

// news.module.ts
import { Module } from '@nestjs/common';

@Module({
  controllers: [NewsController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}
