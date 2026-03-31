import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios from 'axios';
import { Stock, Quote } from './stock.entity';

@Injectable()
export class StocksService {
  private readonly logger = new Logger(StocksService.name);
  private readonly scraperUrl = process.env.SCRAPER_URL || 'http://localhost:8000';

  constructor(
    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,
    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
    private readonly dataSource: DataSource,
  ) {}

  // ============================================================
  // 股票搜索（支持中文、英文、代码）
  // ============================================================
  async search(query: string, limit = 10): Promise<any[]> {
    const cacheKey = `search:${query}:${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached as any[];

    // 优先从数据库搜索
    const dbResults = await this.dataSource.query(
      `SELECT * FROM search_stocks($1, $2)`,
      [query, limit],
    );

    // 如果数据库结果不足，调用爬虫补充
    if (dbResults.length < 3) {
      try {
        const scraperResults = await this.fetchFromScraper(`/search?q=${encodeURIComponent(query)}`);
        if (scraperResults?.data?.length) {
          await this.saveStocks(scraperResults.data);
          return await this.dataSource.query(`SELECT * FROM search_stocks($1, $2)`, [query, limit]);
        }
      } catch (err) {
        this.logger.warn(`爬虫搜索失败: ${err.message}`);
      }
    }

    const results = dbResults.length ? dbResults : [];
    await this.cache.set(cacheKey, results, 60);
    return results;
  }

  // ============================================================
  // 获取股票详情
  // ============================================================
  async getStockDetail(symbol: string): Promise<any> {
    const cacheKey = `stock:detail:${symbol}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // 1. 从数据库获取基础信息
    let stock = await this.stockRepo.findOne({ where: { symbol: symbol.toUpperCase() } });

    // 2. 如果不存在，爬取数据
    if (!stock) {
      try {
        const scraperData = await this.fetchFromScraper(`/stocks/${symbol}`);
        if (scraperData?.data) {
          stock = await this.stockRepo.save(
            this.stockRepo.create({ ...scraperData.data, symbol: symbol.toUpperCase() }),
          );
        }
      } catch (err) {
        this.logger.warn(`爬取股票详情失败: ${err.message}`);
      }
      if (!stock) throw new NotFoundException(`股票 ${symbol} 不存在`);
    }

    // 3. 获取最新行情
    const quote = await this.quoteRepo.findOne({
      where: { symbol: symbol.toUpperCase() },
      order: { quotedAt: 'DESC' },
    });

    // 4. 如果行情过期，重新爬取
    const quoteAge = quote
      ? (Date.now() - new Date(quote.quotedAt).getTime()) / 1000
      : Infinity;

    if (quoteAge > 60) {
      this.refreshQuote(symbol).catch((e) => this.logger.warn(`行情更新失败: ${e.message}`));
    }

    const result = { ...stock, quote };
    await this.cache.set(cacheKey, result, 30);
    return result;
  }

  // ============================================================
  // 获取K线数据
  // ============================================================
  async getKlines(
    symbol: string,
    period: string = '1d',
    from?: string,
    to?: string,
    limit = 300,
  ): Promise<any[]> {
    const cacheKey = `klines:${symbol}:${period}:${from}:${to}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached as any[];

    // 先查数据库
    let query = this.dataSource
      .getRepository('klines')
      .createQueryBuilder('k')
      .where('k.symbol = :symbol', { symbol: symbol.toUpperCase() })
      .andWhere('k.period = :period', { period })
      .orderBy('k.open_time', 'DESC')
      .limit(limit);

    if (from) query = query.andWhere('k.open_time >= :from', { from });
    if (to) query = query.andWhere('k.close_time <= :to', { to });

    let klines = await query.getMany();

    // 如果数据不足，爬取
    if (klines.length < 30) {
      try {
        const scraperData = await this.fetchFromScraper(
          `/klines/${symbol}?period=${period}&limit=${limit}`,
        );
        if (scraperData?.data?.length) {
          await this.saveKlines(symbol, period, scraperData.data);
          klines = await query.getMany();
        }
      } catch (err) {
        this.logger.warn(`K线爬取失败: ${err.message}`);
        // 降级：调用Yahoo Finance API
        klines = await this.fetchKlinesFromAPI(symbol, period, limit);
      }
    }

    const result = klines.sort((a: any, b: any) =>
      new Date(a.open_time).getTime() - new Date(b.open_time).getTime(),
    );
    await this.cache.set(cacheKey, result, period === '1d' ? 300 : 3600);
    return result;
  }

  // ============================================================
  // 获取财务数据
  // ============================================================
  async getFinancials(symbol: string, periodType = 'annual'): Promise<any[]> {
    const cacheKey = `financials:${symbol}:${periodType}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached as any[];

    let data = await this.dataSource.query(
      `SELECT * FROM financials WHERE symbol=$1 AND period_type=$2 ORDER BY period DESC LIMIT 8`,
      [symbol.toUpperCase(), periodType],
    );

    if (!data.length) {
      try {
        const scraperData = await this.fetchFromScraper(
          `/financials/${symbol}?type=${periodType}`,
        );
        if (scraperData?.data) {
          data = scraperData.data;
        }
      } catch (err) {
        this.logger.warn(`财务数据爬取失败: ${err.message}`);
      }
    }

    await this.cache.set(cacheKey, data, 3600);
    return data;
  }

  // ============================================================
  // 内部方法：调用爬虫服务
  // ============================================================
  private async fetchFromScraper(path: string): Promise<any> {
    const response = await axios.get(`${this.scraperUrl}${path}`, { timeout: 10000 });
    return response.data;
  }

  // ============================================================
  // 内部方法：Yahoo Finance API降级
  // ============================================================
  private async fetchKlinesFromAPI(
    symbol: string,
    period: string,
    limit: number,
  ): Promise<any[]> {
    try {
      const interval = period === '1d' ? '1d' : period === '1w' ? '1wk' : '1mo';
      const range = period === '1d' ? '1y' : period === '1w' ? '2y' : '5y';
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 8000,
      });

      const chart = res.data?.chart?.result?.[0];
      if (!chart) return [];

      const timestamps = chart.timestamp || [];
      const ohlcv = chart.indicators?.quote?.[0] || {};
      return timestamps.map((ts: number, i: number) => ({
        symbol,
        period,
        open_time: new Date(ts * 1000).toISOString(),
        close_time: new Date(ts * 1000).toISOString(),
        open: ohlcv.open?.[i] || 0,
        high: ohlcv.high?.[i] || 0,
        low: ohlcv.low?.[i] || 0,
        close: ohlcv.close?.[i] || 0,
        volume: ohlcv.volume?.[i] || 0,
      }));
    } catch (err) {
      this.logger.error(`Yahoo Finance API失败: ${err.message}`);
      return [];
    }
  }

  // ============================================================
  // 刷新实时行情
  // ============================================================
  async refreshQuote(symbol: string): Promise<Quote | null> {
    try {
      // 优先爬虫
      const scraperData = await this.fetchFromScraper(`/quote/${symbol}`);
      if (scraperData?.data) {
        return await this.quoteRepo.save(
          this.quoteRepo.create({ ...scraperData.data, symbol: symbol.toUpperCase() }),
        );
      }
    } catch {
      // 降级到Yahoo Finance API
      try {
        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
        const res = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 5000,
        });
        const q = res.data?.quoteResponse?.result?.[0];
        if (!q) return null;
        return await this.quoteRepo.save(
          this.quoteRepo.create({
            symbol: symbol.toUpperCase(),
            price: q.regularMarketPrice,
            open: q.regularMarketOpen,
            high: q.regularMarketDayHigh,
            low: q.regularMarketDayLow,
            prevClose: q.regularMarketPreviousClose,
            change: q.regularMarketChange,
            changePct: q.regularMarketChangePercent,
            volume: q.regularMarketVolume,
            marketCap: q.marketCap,
            peRatio: q.trailingPE,
            week52High: q.fiftyTwoWeekHigh,
            week52Low: q.fiftyTwoWeekLow,
            source: 'yahoo_api',
          }),
        );
      } catch (err) {
        this.logger.error(`行情获取失败: ${err.message}`);
        return null;
      }
    }
    return null;
  }

  // ============================================================
  // 批量保存股票
  // ============================================================
  private async saveStocks(stocks: any[]) {
    for (const s of stocks) {
      await this.stockRepo.upsert(
        {
          symbol: s.symbol?.toUpperCase(),
          nameEn: s.name_en || s.nameEn,
          nameZh: s.name_zh || s.nameZh,
          exchange: s.exchange,
          sector: s.sector,
          industry: s.industry,
          country: s.country,
        },
        ['symbol'],
      );
    }
  }

  // ============================================================
  // 保存K线数据
  // ============================================================
  private async saveKlines(symbol: string, period: string, data: any[]) {
    const values = data.map((d) => ({
      symbol: symbol.toUpperCase(),
      period,
      openTime: new Date(d.open_time || d.timestamp),
      closeTime: new Date(d.close_time || d.timestamp),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume || 0,
    }));

    await this.dataSource.getRepository('klines').upsert(values, ['symbol', 'period', 'openTime']);
  }
}
