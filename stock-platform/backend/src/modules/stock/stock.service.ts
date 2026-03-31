import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { StockEntity, QuoteEntity, KlineEntity } from './stock.entity';
import axios from 'axios';

@Injectable()
export class StockService {
  private readonly CRAWLER_URL = process.env.CRAWLER_URL || 'http://localhost:8001';

  constructor(
    @InjectRepository(StockEntity)
    private stockRepo: Repository<StockEntity>,
    @InjectRepository(QuoteEntity)
    private quoteRepo: Repository<QuoteEntity>,
    @InjectRepository(KlineEntity)
    private klineRepo: Repository<KlineEntity>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  /**
   * 股票搜索 - 支持中文/英文/代码
   */
  async search(query: string, limit = 20) {
    const cacheKey = `search:${query}:${limit}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const q = query.trim().toUpperCase();

    const results = await this.stockRepo
      .createQueryBuilder('s')
      .where('s.symbol ILIKE :exact', { exact: `${q}%` })
      .orWhere('s.name_en ILIKE :fuzzy', { fuzzy: `%${query}%` })
      .orWhere('s.name_zh ILIKE :fuzzyZh', { fuzzyZh: `%${query}%` })
      .orderBy(`
        CASE
          WHEN UPPER(s.symbol) = '${q}' THEN 0
          WHEN UPPER(s.symbol) LIKE '${q}%' THEN 1
          WHEN s.name_zh ILIKE '%${query}%' THEN 2
          ELSE 3
        END
      `)
      .take(limit)
      .getMany();

    await this.cacheManager.set(cacheKey, results, 300);
    return results;
  }

  /**
   * 获取股票详情
   */
  async getDetail(symbol: string) {
    const cacheKey = `detail:${symbol}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const stock = await this.stockRepo.findOne({
      where: { symbol: symbol.toUpperCase() },
    });
    if (!stock) throw new NotFoundException(`股票 ${symbol} 不存在`);

    // 获取实时行情
    const quote = await this.getQuote(symbol);

    // 并发获取多项数据
    const result = {
      ...stock,
      quote,
    };

    await this.cacheManager.set(cacheKey, result, 30);
    return result;
  }

  /**
   * 获取实时行情（爬虫优先，API兜底）
   */
  async getQuote(symbol: string) {
    try {
      // 优先从爬虫获取
      const res = await axios.get(`${this.CRAWLER_URL}/quote/${symbol}`, {
        timeout: 5000,
      });
      if (res.data?.price) {
        // 存入数据库
        await this.saveQuote(symbol, res.data);
        return res.data;
      }
    } catch (e) {
      console.warn(`爬虫获取行情失败，降级API: ${symbol}`);
    }

    // 降级：从数据库取最新
    return this.quoteRepo.findOne({
      where: { symbol: symbol.toUpperCase() },
      order: { timestamp: 'DESC' },
    });
  }

  /**
   * 获取K线数据
   */
  async getKline(symbol: string, period: string = '1d', limit: number = 200) {
    const cacheKey = `kline:${symbol}:${period}:${limit}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    // 优先从爬虫获取
    try {
      const res = await axios.get(`${this.CRAWLER_URL}/kline/${symbol}`, {
        params: { period, limit },
        timeout: 8000,
      });
      if (res.data?.length > 0) {
        // 批量存储
        await this.saveKlineData(symbol, period, res.data);
        await this.cacheManager.set(cacheKey, res.data, 60);
        return res.data;
      }
    } catch (e) {
      console.warn(`爬虫K线获取失败，降级数据库: ${symbol}`);
    }

    // 从数据库取
    const data = await this.klineRepo.find({
      where: { symbol: symbol.toUpperCase(), period },
      order: { openTime: 'DESC' },
      take: limit,
    });

    const result = data.reverse();
    await this.cacheManager.set(cacheKey, result, 60);
    return result;
  }

  /**
   * 获取热门股票列表（用于热力图）
   */
  async getTopStocks(limit = 100) {
    const cacheKey = `top_stocks:${limit}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    try {
      const res = await axios.get(`${this.CRAWLER_URL}/heatmap/stocks`, {
        params: { limit },
        timeout: 10000,
      });
      if (res.data?.length > 0) {
        await this.cacheManager.set(cacheKey, res.data, 120);
        return res.data;
      }
    } catch (e) {
      console.warn('获取热门股票失败');
    }

    // 从数据库获取
    const stocks = await this.stockRepo
      .createQueryBuilder('s')
      .leftJoin(QuoteEntity, 'q', 'q.symbol = s.symbol')
      .select(['s.*', 'q.price', 'q.change_percent', 'q.market_cap'])
      .orderBy('q.market_cap', 'DESC')
      .take(limit)
      .getRawMany();

    await this.cacheManager.set(cacheKey, stocks, 120);
    return stocks;
  }

  private async saveQuote(symbol: string, data: any) {
    try {
      await this.quoteRepo.upsert(
        { symbol: symbol.toUpperCase(), ...data, timestamp: new Date() },
        ['symbol'],
      );
    } catch (e) {
      console.error('保存行情失败:', e);
    }
  }

  private async saveKlineData(symbol: string, period: string, data: any[]) {
    try {
      const entities = data.map(d => ({
        symbol: symbol.toUpperCase(),
        period,
        openTime: new Date(d.time * 1000 || d.time),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
      }));
      await this.klineRepo.upsert(entities, ['symbol', 'period', 'openTime']);
    } catch (e) {
      console.error('保存K线失败:', e);
    }
  }

  /**
   * 获取财务数据
   */
  async getFinancials(symbol: string) {
    const cacheKey = `financials:${symbol}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    try {
      const res = await axios.get(`${this.CRAWLER_URL}/financials/${symbol}`, {
        timeout: 10000,
      });
      if (res.data) {
        await this.cacheManager.set(cacheKey, res.data, 3600);
        return res.data;
      }
    } catch (e) {
      console.warn(`财务数据获取失败: ${symbol}`);
    }
    return null;
  }
}
