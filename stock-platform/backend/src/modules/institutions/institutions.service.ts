import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios from 'axios';

@Injectable()
export class InstitutionsService {
  private readonly logger = new Logger(InstitutionsService.name);
  private readonly scraperUrl = process.env.SCRAPER_URL || 'http://localhost:8000';

  constructor(
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // ============================================================
  // 获取热门机构列表（首页展示）
  // ============================================================
  async getTopInstitutions(limit = 6): Promise<any[]> {
    const cacheKey = `institutions:top:${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached as any[];

    const data = await this.dataSource.query(`
      SELECT
        i.id, i.cik, i.name, i.name_zh, i.type, i.aum,
        i.logo_url, i.filing_date,
        COUNT(h.id)::INTEGER AS holdings_count,
        SUM(h.market_value) AS total_holdings_value,
        -- 最大持仓
        (
          SELECT json_build_object('symbol', h2.symbol, 'company_name', h2.company_name, 'market_value', h2.market_value)
          FROM holdings h2
          WHERE h2.institution_id = i.id
          AND h2.filing_quarter = (SELECT MAX(filing_quarter) FROM holdings WHERE institution_id = i.id)
          ORDER BY h2.market_value DESC
          LIMIT 1
        ) AS top_holding,
        -- 最新变动
        (
          SELECT json_agg(json_build_object(
            'symbol', h3.symbol,
            'company_name', h3.company_name,
            'change_type', h3.change_type,
            'share_change', h3.share_change
          ))
          FROM (
            SELECT * FROM holdings h3
            WHERE h3.institution_id = i.id
            AND h3.change_type IN ('buy', 'sell', 'new', 'closed')
            AND h3.filing_quarter = (SELECT MAX(filing_quarter) FROM holdings WHERE institution_id = i.id)
            ORDER BY ABS(COALESCE(h3.share_change, 0)) DESC
            LIMIT 3
          ) h3
        ) AS recent_changes
      FROM institutions i
      LEFT JOIN holdings h ON h.institution_id = i.id
      WHERE i.is_active = TRUE
      GROUP BY i.id
      ORDER BY SUM(h.market_value) DESC NULLS LAST
      LIMIT $1
    `, [limit]);

    await this.cache.set(cacheKey, data, 300);
    return data;
  }

  // ============================================================
  // 机构排行榜（分页）
  // ============================================================
  async getRanking(page = 1, pageSize = 20, sortBy = 'aum'): Promise<any> {
    const cacheKey = `institutions:ranking:${page}:${pageSize}:${sortBy}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const offset = (page - 1) * pageSize;
    const validSortBy = ['aum', 'holdings_count', 'total_holdings_value'];
    const orderCol = validSortBy.includes(sortBy) ? sortBy : 'total_holdings_value';

    const [data, total] = await Promise.all([
      this.dataSource.query(`
        SELECT
          ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(h.market_value), i.aum) DESC NULLS LAST) AS rank,
          i.id, i.name, i.name_zh, i.cik, i.type,
          i.aum, i.filing_date, i.logo_url,
          COUNT(DISTINCT h.symbol)::INTEGER AS holdings_count,
          SUM(h.market_value) AS total_holdings_value,
          -- 季度变化
          SUM(CASE WHEN h.change_type IN ('buy', 'new') THEN h.market_value ELSE 0 END) AS bought_value,
          SUM(CASE WHEN h.change_type IN ('sell', 'closed') THEN ABS(h.market_value) ELSE 0 END) AS sold_value,
          MAX(h.filing_quarter) AS latest_quarter
        FROM institutions i
        LEFT JOIN holdings h ON h.institution_id = i.id
        WHERE i.is_active = TRUE
        GROUP BY i.id
        ORDER BY COALESCE(SUM(h.market_value), i.aum) DESC NULLS LAST
        LIMIT $1 OFFSET $2
      `, [pageSize, offset]),
      this.dataSource.query(`SELECT COUNT(*) FROM institutions WHERE is_active = TRUE`),
    ]);

    const result = {
      data,
      total: +total[0].count,
      page,
      pageSize,
      totalPages: Math.ceil(+total[0].count / pageSize),
    };
    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  // ============================================================
  // 机构详情
  // ============================================================
  async getDetail(id: string): Promise<any> {
    const cacheKey = `institution:detail:${id}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const institution = await this.dataSource.query(
      `SELECT * FROM institutions WHERE id=$1`, [id],
    );
    if (!institution.length) throw new NotFoundException('机构不存在');

    const inst = institution[0];

    // 并行获取所有相关数据
    const [sectorAllocation, topHoldings, recentChanges, quarterHistory] = await Promise.all([
      // 行业配置
      this.dataSource.query(`
        SELECT sector, SUM(market_value) AS total_value,
          (SUM(market_value) / SUM(SUM(market_value)) OVER() * 100)::DECIMAL(8,2) AS pct
        FROM holdings
        WHERE institution_id = $1
        AND filing_quarter = (SELECT MAX(filing_quarter) FROM holdings WHERE institution_id = $1)
        AND sector IS NOT NULL
        GROUP BY sector
        ORDER BY total_value DESC
      `, [id]),

      // 前10大持仓
      this.dataSource.query(`
        SELECT symbol, company_name, shares, market_value, portfolio_pct, sector, change_type, share_change
        FROM holdings
        WHERE institution_id = $1
        AND filing_quarter = (SELECT MAX(filing_quarter) FROM holdings WHERE institution_id = $1)
        ORDER BY market_value DESC
        LIMIT 10
      `, [id]),

      // 近期增减仓
      this.dataSource.query(`
        SELECT symbol, company_name, market_value, share_change,
          (share_change::FLOAT / NULLIF(ABS(shares - COALESCE(share_change,0)), 0) * 100)::DECIMAL(8,2) AS change_pct,
          change_type
        FROM holdings
        WHERE institution_id = $1
        AND filing_quarter = (SELECT MAX(filing_quarter) FROM holdings WHERE institution_id = $1)
        AND change_type IN ('buy', 'sell', 'new', 'closed')
        AND share_change != 0
        ORDER BY ABS(COALESCE(share_change,0)) DESC
        LIMIT 20
      `, [id]),

      // 历史持仓季度
      this.dataSource.query(`
        SELECT filing_quarter, COUNT(*) AS holdings_count, SUM(market_value) AS total_value
        FROM holdings WHERE institution_id = $1
        GROUP BY filing_quarter ORDER BY filing_quarter DESC LIMIT 8
      `, [id]),
    ]);

    const result = {
      ...inst,
      sectorAllocation,
      topHoldings,
      recentChanges,
      quarterHistory,
    };

    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  // ============================================================
  // 机构持仓列表（分页+搜索+排序）
  // ============================================================
  async getHoldings(
    institutionId: string,
    page = 1,
    pageSize = 20,
    search = '',
    sortBy = 'market_value',
    sortDir = 'DESC',
  ): Promise<any> {
    const offset = (page - 1) * pageSize;
    const validSort = ['market_value', 'portfolio_pct', 'shares', 'share_change'];
    const col = validSort.includes(sortBy) ? sortBy : 'market_value';
    const dir = sortDir === 'ASC' ? 'ASC' : 'DESC';

    const searchCondition = search
      ? `AND (h.symbol ILIKE '%${search}%' OR h.company_name ILIKE '%${search}%')`
      : '';

    const [data, countResult] = await Promise.all([
      this.dataSource.query(`
        SELECT
          h.symbol, h.company_name, h.shares, h.market_value,
          h.portfolio_pct, h.sector, h.industry, h.change_type, h.share_change,
          q.price, q.change_pct, q.volume
        FROM holdings h
        LEFT JOIN LATERAL (
          SELECT price, change_pct, volume FROM quotes
          WHERE symbol = h.symbol ORDER BY quoted_at DESC LIMIT 1
        ) q ON true
        WHERE h.institution_id = $1
        AND h.filing_quarter = (SELECT MAX(filing_quarter) FROM holdings WHERE institution_id = $1)
        ${searchCondition}
        ORDER BY h.${col} ${dir} NULLS LAST
        LIMIT $2 OFFSET $3
      `, [institutionId, pageSize, offset]),
      this.dataSource.query(`
        SELECT COUNT(*) FROM holdings
        WHERE institution_id = $1
        AND filing_quarter = (SELECT MAX(filing_quarter) FROM holdings WHERE institution_id = $1)
        ${searchCondition}
      `, [institutionId]),
    ]);

    return {
      data,
      total: +countResult[0].count,
      page,
      pageSize,
      totalPages: Math.ceil(+countResult[0].count / pageSize),
    };
  }

  // ============================================================
  // 爬取SEC 13F数据
  // ============================================================
  async crawlSEC13F(cik: string): Promise<void> {
    this.logger.log(`开始爬取SEC 13F: CIK=${cik}`);
    try {
      const response = await axios.get(`${this.scraperUrl}/institutions/sec/${cik}`, {
        timeout: 30000,
      });
      if (response.data?.success) {
        this.logger.log(`SEC 13F爬取完成: CIK=${cik}`);
      }
    } catch (err) {
      this.logger.error(`SEC 13F爬取失败: ${err.message}`);
    }
  }
}
