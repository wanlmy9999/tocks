import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import axios from 'axios';
import { Cache } from 'cache-manager';
import { DataSource } from 'typeorm';

@Injectable()
export class HeatmapService {
  private readonly logger = new Logger(HeatmapService.name);
  private readonly scraperUrl = process.env.SCRAPER_URL || 'http://localhost:8000';

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getHeatmapData(market = 'us', sector?: string): Promise<any[]> {
    const cacheKey = `heatmap:${market}:${sector || 'all'}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached as any[];

    let whereClause = "WHERE s.is_active = TRUE";
    if (sector) whereClause += ` AND s.sector = '${sector.replace(/'/g, "''")}'`;

    const dbData = await this.ds.query(`
      SELECT
        s.symbol, s.name_zh, s.name_en AS name, s.sector,
        q.price, q.change_pct, q.market_cap, q.volume
      FROM stocks s
      JOIN LATERAL (
        SELECT price, change_pct, market_cap, volume
        FROM quotes WHERE symbol = s.symbol
        ORDER BY quoted_at DESC LIMIT 1
      ) q ON true
      ${whereClause}
      ORDER BY q.market_cap DESC NULLS LAST
      LIMIT 100
    `);

    if (dbData.length >= 10) {
      await this.cache.set(cacheKey, dbData, 60);
      return dbData;
    }

    try {
      const res = await axios.get(`${this.scraperUrl}/heatmap`, {
        params: { market, sector },
        timeout: 10000,
      });
      const scraperData = res.data?.data || [];
      await this.cache.set(cacheKey, scraperData, 60);
      return scraperData;
    } catch (err) {
      this.logger.warn(`Scraper unavailable, using fallback: ${err.message}`);
      return FALLBACK_HEATMAP;
    }
  }

  async getSectors(): Promise<string[]> {
    const cacheKey = 'heatmap:sectors';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached as string[];

    const rows = await this.ds.query(
      `SELECT DISTINCT sector FROM stocks WHERE sector IS NOT NULL ORDER BY sector`,
    );
    const sectors = rows.map((r: any) => r.sector);
    await this.cache.set(cacheKey, sectors, 3600);
    return sectors;
  }
}

const FALLBACK_HEATMAP = [
  { symbol: 'AAPL', name: 'Apple', name_zh: '苹果', price: 189.3, change_pct: 1.24, market_cap: 2.9e12, volume: 58e6, sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft', name_zh: '微软', price: 415.5, change_pct: 0.87, market_cap: 3.1e12, volume: 22e6, sector: 'Technology' },
  { symbol: 'NVDA', name: 'NVIDIA', name_zh: '英伟达', price: 875.4, change_pct: 3.42, market_cap: 2.1e12, volume: 41e6, sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet', name_zh: '谷歌', price: 175.8, change_pct: -0.43, market_cap: 2.2e12, volume: 26e6, sector: 'Technology' },
  { symbol: 'META', name: 'Meta', name_zh: 'Meta', price: 505.1, change_pct: 2.11, market_cap: 1.28e12, volume: 18e6, sector: 'Technology' },
  { symbol: 'TSLA', name: 'Tesla', name_zh: '特斯拉', price: 248.5, change_pct: -2.34, market_cap: 790e9, volume: 112e6, sector: 'Consumer Discretionary' },
  { symbol: 'AMZN', name: 'Amazon', name_zh: '亚马逊', price: 185.6, change_pct: -0.78, market_cap: 1.93e12, volume: 35e6, sector: 'Consumer Discretionary' },
  { symbol: 'JPM', name: 'JPMorgan', name_zh: '摩根大通', price: 198.3, change_pct: 0.56, market_cap: 570e9, volume: 10e6, sector: 'Financial' },
  { symbol: 'XOM', name: 'ExxonMobil', name_zh: '埃克森美孚', price: 112.4, change_pct: 1.87, market_cap: 448e9, volume: 16e6, sector: 'Energy' },
  { symbol: 'AMD', name: 'AMD', name_zh: 'AMD', price: 168.9, change_pct: 4.21, market_cap: 272e9, volume: 62e6, sector: 'Technology' },
];
