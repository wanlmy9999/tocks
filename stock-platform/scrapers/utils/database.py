"""
数据库连接管理 - asyncpg
"""
import os
import logging
from typing import List, Dict, Optional, Any
import asyncpg
from datetime import datetime

logger = logging.getLogger(__name__)


class DatabaseManager:
    """PostgreSQL异步数据库管理器"""

    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.dsn = (
            f"postgresql://{os.getenv('DB_USER','postgres')}:"
            f"{os.getenv('DB_PASS','postgres')}@"
            f"{os.getenv('DB_HOST','localhost')}:"
            f"{os.getenv('DB_PORT','5432')}/"
            f"{os.getenv('DB_NAME','stock_platform')}"
        )

    async def connect(self):
        """建立连接池"""
        try:
            self.pool = await asyncpg.create_pool(self.dsn, min_size=2, max_size=10)
            logger.info("✅ 数据库连接池建立成功")
        except Exception as e:
            logger.error(f"数据库连接失败: {e}")

    async def disconnect(self):
        if self.pool:
            await self.pool.close()

    # ============================================================
    # 股票基础信息
    # ============================================================
    async def upsert_stock(self, data: Dict) -> bool:
        if not self.pool:
            return False
        sql = """
            INSERT INTO stocks (symbol, name_en, name_zh, exchange, sector, industry, country, website, description, logo_url)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (symbol) DO UPDATE SET
                name_en = EXCLUDED.name_en,
                name_zh = COALESCE(EXCLUDED.name_zh, stocks.name_zh),
                sector = COALESCE(EXCLUDED.sector, stocks.sector),
                industry = COALESCE(EXCLUDED.industry, stocks.industry),
                website = COALESCE(EXCLUDED.website, stocks.website),
                description = COALESCE(EXCLUDED.description, stocks.description),
                updated_at = NOW()
        """
        try:
            async with self.pool.acquire() as conn:
                await conn.execute(sql,
                    data.get('symbol','').upper(),
                    data.get('name_en',''),
                    data.get('name_zh'),
                    data.get('exchange'),
                    data.get('sector'),
                    data.get('industry'),
                    data.get('country','US'),
                    data.get('website'),
                    data.get('description'),
                    data.get('logo_url'),
                )
            return True
        except Exception as e:
            logger.error(f"upsert_stock失败: {e}")
            return False

    # ============================================================
    # 实时行情
    # ============================================================
    async def save_quote(self, data: Dict) -> bool:
        if not self.pool:
            return False
        sql = """
            INSERT INTO quotes (symbol, price, open, high, low, prev_close, change, change_pct,
                volume, market_cap, pe_ratio, week_52_high, week_52_low, avg_volume, beta, source)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        """
        try:
            async with self.pool.acquire() as conn:
                await conn.execute(sql,
                    data['symbol'].upper(),
                    data.get('price'),
                    data.get('open'),
                    data.get('high'),
                    data.get('low'),
                    data.get('prev_close'),
                    data.get('change'),
                    data.get('change_pct'),
                    data.get('volume'),
                    data.get('market_cap'),
                    data.get('pe_ratio'),
                    data.get('week_52_high'),
                    data.get('week_52_low'),
                    data.get('avg_volume'),
                    data.get('beta'),
                    data.get('source', 'scraper'),
                )
            return True
        except Exception as e:
            logger.error(f"save_quote失败: {e}")
            return False

    # ============================================================
    # K线数据
    # ============================================================
    async def save_klines(self, symbol: str, period: str, data: List[Dict]) -> int:
        if not self.pool or not data:
            return 0
        sql = """
            INSERT INTO klines (symbol, period, open_time, close_time, open, high, low, close, volume, source)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (symbol, period, open_time) DO UPDATE SET
                open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low,
                close=EXCLUDED.close, volume=EXCLUDED.volume
        """
        saved = 0
        try:
            async with self.pool.acquire() as conn:
                for item in data:
                    try:
                        await conn.execute(sql,
                            symbol.upper(), period,
                            item.get('open_time'), item.get('close_time') or item.get('open_time'),
                            item.get('open'), item.get('high'), item.get('low'), item.get('close'),
                            item.get('volume', 0), 'scraper',
                        )
                        saved += 1
                    except Exception as e:
                        logger.debug(f"K线插入失败: {e}")
        except Exception as e:
            logger.error(f"save_klines失败: {e}")
        return saved

    # ============================================================
    # 新闻
    # ============================================================
    async def save_news(self, items: List[Dict]) -> int:
        if not self.pool or not items:
            return 0
        sql = """
            INSERT INTO news (symbol, title, content, summary, source, source_url, language, image_url, content_hash, published_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (content_hash) DO NOTHING
        """
        saved = 0
        async with self.pool.acquire() as conn:
            for item in items:
                try:
                    await conn.execute(sql,
                        item.get('symbol'), item.get('title',''),
                        item.get('content'), item.get('summary'),
                        item.get('source'), item.get('source_url'),
                        item.get('language','en'), item.get('image_url'),
                        item.get('content_hash'),
                        item.get('published_at'),
                    )
                    saved += 1
                except Exception:
                    pass
        return saved

    # ============================================================
    # 机构数据
    # ============================================================
    async def upsert_institution(self, data: Dict) -> Optional[str]:
        if not self.pool:
            return None
        sql = """
            INSERT INTO institutions (cik, name, entity_type)
            VALUES ($1,$2,$3)
            ON CONFLICT (cik) DO UPDATE SET
                name = EXCLUDED.name,
                updated_at = NOW()
            RETURNING id
        """
        try:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(sql,
                    data.get('cik'), data.get('name',''), data.get('entity_type',''),
                )
                return str(row['id']) if row else None
        except Exception as e:
            logger.error(f"upsert_institution失败: {e}")
            return None

    async def save_holdings(self, cik: str, holdings: List[Dict]) -> int:
        if not self.pool or not holdings:
            return 0
        inst_id_row = await self.pool.fetchrow("SELECT id FROM institutions WHERE cik=$1", cik)
        if not inst_id_row:
            return 0
        inst_id = inst_id_row['id']

        sql = """
            INSERT INTO holdings (institution_id, symbol, company_name, shares, market_value, portfolio_pct, filing_quarter, filing_date)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            ON CONFLICT DO NOTHING
        """
        saved = 0
        async with self.pool.acquire() as conn:
            for h in holdings:
                try:
                    await conn.execute(sql,
                        inst_id, h.get('symbol','').upper(),
                        h.get('company_name',''),
                        h.get('shares',0), h.get('market_value',0),
                        h.get('portfolio_pct',0), h.get('filing_quarter'),
                        h.get('filing_date'),
                    )
                    saved += 1
                except Exception:
                    pass
        return saved
