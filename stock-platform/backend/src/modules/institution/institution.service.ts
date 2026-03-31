import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InstitutionEntity, HoldingEntity } from './institution.entity';
import axios from 'axios';

@Injectable()
export class InstitutionService {
  private readonly CRAWLER_URL = process.env.CRAWLER_URL || 'http://localhost:8001';

  constructor(
    @InjectRepository(InstitutionEntity)
    private institutionRepo: Repository<InstitutionEntity>,
    @InjectRepository(HoldingEntity)
    private holdingRepo: Repository<HoldingEntity>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  /**
   * 获取热门机构列表（首页展示6个）
   */
  async getTopInstitutions(limit = 6) {
    const cacheKey = `top_institutions:${limit}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const institutions = await this.institutionRepo.find({
      order: { aum: 'DESC' },
      take: limit,
    });

    await this.cacheManager.set(cacheKey, institutions, 3600);
    return institutions;
  }

  /**
   * 机构排行榜（带分页）
   */
  async getRanking(page = 1, limit = 20) {
    const cacheKey = `institution_ranking:${page}:${limit}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const [items, total] = await this.institutionRepo.findAndCount({
      order: { aum: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const result = {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.cacheManager.set(cacheKey, result, 3600);
    return result;
  }

  /**
   * 获取机构详情
   */
  async getDetail(id: string) {
    const institution = await this.institutionRepo.findOne({ where: { id } });
    if (!institution) throw new NotFoundException('机构不存在');

    // 爬虫获取最新数据
    if (institution.cik) {
      try {
        const fresh = await axios.get(
          `${this.CRAWLER_URL}/institution/${institution.cik}`,
          { timeout: 10000 },
        );
        if (fresh.data) {
          await this.institutionRepo.update(id, fresh.data);
          return { ...institution, ...fresh.data };
        }
      } catch (e) {
        console.warn('爬虫获取机构详情失败');
      }
    }

    return institution;
  }

  /**
   * 获取机构持仓列表（分页+排序+搜索）
   */
  async getHoldings(
    institutionId: string,
    page = 1,
    limit = 20,
    sortBy = 'value',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
    search?: string,
  ) {
    const query = this.holdingRepo
      .createQueryBuilder('h')
      .where('h.institution_id = :institutionId', { institutionId });

    if (search) {
      query.andWhere(
        '(h.symbol ILIKE :s OR h.name_of_issuer ILIKE :s)',
        { s: `%${search}%` },
      );
    }

    const validSort = ['value', 'weight', 'shares', 'change_percent'];
    const sortColumn = validSort.includes(sortBy) ? `h.${sortBy}` : 'h.value';

    const [items, total] = await query
      .orderBy(sortColumn, sortOrder)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取机构行业配置（饼图数据）
   */
  async getSectorAllocation(institutionId: string) {
    const cacheKey = `sector_alloc:${institutionId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const result = await this.holdingRepo
      .createQueryBuilder('h')
      .select('h.sector', 'sector')
      .addSelect('SUM(h.value)', 'totalValue')
      .addSelect('COUNT(*)', 'count')
      .where('h.institution_id = :id', { id: institutionId })
      .andWhere('h.sector IS NOT NULL')
      .groupBy('h.sector')
      .orderBy('SUM(h.value)', 'DESC')
      .getRawMany();

    await this.cacheManager.set(cacheKey, result, 3600);
    return result;
  }

  /**
   * 获取增减仓变动
   */
  async getChanges(institutionId: string, action?: string) {
    const query = this.holdingRepo
      .createQueryBuilder('h')
      .where('h.institution_id = :id', { id: institutionId })
      .andWhere('h.change_shares IS NOT NULL');

    if (action) {
      query.andWhere('h.action = :action', { action });
    }

    return query
      .orderBy('ABS(h.change_percent)', 'DESC')
      .take(20)
      .getMany();
  }

  /**
   * SEC 13F数据同步（爬虫触发）
   */
  async syncSEC13F(cik: string) {
    try {
      const res = await axios.post(`${this.CRAWLER_URL}/crawl/sec13f`, { cik });
      return res.data;
    } catch (e) {
      throw new Error(`同步SEC 13F失败: ${e.message}`);
    }
  }
}
