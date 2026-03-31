"""
Yahoo Finance 爬虫
爬取：股票详情、实时行情、K线数据、财务数据
"""
import asyncio
import random
import logging
from typing import Optional, List, Dict, Any
import aiohttp
import json
from datetime import datetime, timedelta
from utils.helpers import retry_async, get_random_ua, clean_number

logger = logging.getLogger(__name__)

YAHOO_BASE = "https://query1.finance.yahoo.com"
YAHOO_BASE2 = "https://query2.finance.yahoo.com"


class YahooFinanceSpider:
    """Yahoo Finance 高并发爬虫"""

    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.headers = {
            "User-Agent": get_random_ua(),
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://finance.yahoo.com/",
        }

    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            headers=self.headers,
            timeout=aiohttp.ClientTimeout(total=15),
            connector=aiohttp.TCPConnector(ssl=False, limit=20),
        )
        return self

    async def __aexit__(self, *args):
        if self.session:
            await self.session.close()

    async def _get(self, url: str, params: dict = None) -> Optional[dict]:
        """带重试的GET请求"""
        async with aiohttp.ClientSession(
            headers={**self.headers, "User-Agent": get_random_ua()},
            timeout=aiohttp.ClientTimeout(total=15),
            connector=aiohttp.TCPConnector(ssl=False),
        ) as session:
            for attempt in range(3):
                try:
                    await asyncio.sleep(random.uniform(0.5, 1.5))
                    async with session.get(url, params=params) as resp:
                        if resp.status == 200:
                            return await resp.json()
                        elif resp.status == 429:
                            wait = (2 ** attempt) * 2
                            logger.warning(f"限速，等待{wait}s后重试...")
                            await asyncio.sleep(wait)
                        else:
                            logger.warning(f"HTTP {resp.status}: {url}")
                except aiohttp.ClientError as e:
                    logger.error(f"请求失败(尝试{attempt+1}): {e}")
                    if attempt == 2:
                        raise
                    await asyncio.sleep(2 ** attempt)
        return None

    # ============================================================
    # 获取股票详情
    # ============================================================
    async def get_stock_detail(self, symbol: str) -> Optional[Dict]:
        """爬取股票基础信息"""
        url = f"{YAHOO_BASE}/v10/finance/quoteSummary/{symbol}"
        params = {
            "modules": "assetProfile,summaryDetail,defaultKeyStatistics,financialData",
            "formatted": "false",
        }
        data = await self._get(url, params)
        if not data:
            return None

        result = data.get("quoteSummary", {}).get("result", [])
        if not result:
            return None

        profile = result[0].get("assetProfile", {})
        summary = result[0].get("summaryDetail", {})
        stats = result[0].get("defaultKeyStatistics", {})

        return {
            "symbol": symbol,
            "name_en": profile.get("longName", symbol),
            "exchange": summary.get("exchange", ""),
            "sector": profile.get("sector", ""),
            "industry": profile.get("industry", ""),
            "country": profile.get("country", "US"),
            "website": profile.get("website", ""),
            "description": profile.get("longBusinessSummary", ""),
            "employees": profile.get("fullTimeEmployees"),
            "logo_url": f"https://logo.clearbit.com/{profile.get('website', '').replace('https://', '').replace('http://', '').split('/')[0]}",
            "source": "yahoo_scraper",
        }

    # ============================================================
    # 获取实时行情
    # ============================================================
    async def get_quote(self, symbol: str) -> Optional[Dict]:
        """爬取实时行情"""
        url = f"{YAHOO_BASE}/v7/finance/quote"
        params = {"symbols": symbol, "fields": "regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,regularMarketDayHigh,regularMarketDayLow,regularMarketOpen,regularMarketPreviousClose,marketCap,trailingPE,fiftyTwoWeekHigh,fiftyTwoWeekLow,averageVolume,beta"}
        data = await self._get(url, params)
        if not data:
            return None

        result = data.get("quoteResponse", {}).get("result", [])
        if not result:
            return None

        q = result[0]
        return {
            "symbol": symbol,
            "price": clean_number(q.get("regularMarketPrice")),
            "open": clean_number(q.get("regularMarketOpen")),
            "high": clean_number(q.get("regularMarketDayHigh")),
            "low": clean_number(q.get("regularMarketDayLow")),
            "prev_close": clean_number(q.get("regularMarketPreviousClose")),
            "change": clean_number(q.get("regularMarketChange")),
            "change_pct": clean_number(q.get("regularMarketChangePercent")),
            "volume": q.get("regularMarketVolume"),
            "market_cap": q.get("marketCap"),
            "pe_ratio": clean_number(q.get("trailingPE")),
            "week_52_high": clean_number(q.get("fiftyTwoWeekHigh")),
            "week_52_low": clean_number(q.get("fiftyTwoWeekLow")),
            "avg_volume": q.get("averageVolume"),
            "beta": clean_number(q.get("beta")),
            "source": "yahoo_scraper",
            "quoted_at": datetime.utcnow().isoformat(),
        }

    # ============================================================
    # 获取K线数据
    # ============================================================
    async def get_klines(self, symbol: str, period: str = "1d", limit: int = 300) -> List[Dict]:
        """爬取K线历史数据"""
        interval_map = {
            "5m": "5m", "15m": "15m", "1h": "60m",
            "1d": "1d", "1w": "1wk", "1m": "1mo",
        }
        range_map = {
            "5m": "5d", "15m": "1mo", "1h": "3mo",
            "1d": "2y", "1w": "5y", "1m": "10y",
        }

        interval = interval_map.get(period, "1d")
        range_ = range_map.get(period, "2y")

        url = f"{YAHOO_BASE}/v8/finance/chart/{symbol}"
        params = {"interval": interval, "range": range_, "includePrePost": "false"}

        data = await self._get(url, params)
        if not data:
            return []

        chart = data.get("chart", {}).get("result", [])
        if not chart:
            return []

        c = chart[0]
        timestamps = c.get("timestamp", [])
        ohlcv = c.get("indicators", {}).get("quote", [{}])[0]

        klines = []
        for i, ts in enumerate(timestamps):
            o = ohlcv.get("open", [])[i]
            h = ohlcv.get("high", [])[i]
            l = ohlcv.get("low", [])[i]
            cl = ohlcv.get("close", [])[i]
            v = ohlcv.get("volume", [])[i]

            if o is None or cl is None:
                continue

            dt = datetime.utcfromtimestamp(ts)
            klines.append({
                "symbol": symbol,
                "period": period,
                "open_time": dt.isoformat(),
                "close_time": dt.isoformat(),
                "open": round(float(o), 4),
                "high": round(float(h or o), 4),
                "low": round(float(l or o), 4),
                "close": round(float(cl), 4),
                "volume": int(v or 0),
            })

        return klines[-limit:]

    # ============================================================
    # 获取财务数据
    # ============================================================
    async def get_financials(self, symbol: str, period_type: str = "annual") -> List[Dict]:
        """爬取财务数据"""
        modules = "incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory"
        if period_type == "quarterly":
            modules = "incomeStatementHistoryQuarterly,balanceSheetHistoryQuarterly"

        url = f"{YAHOO_BASE}/v10/finance/quoteSummary/{symbol}"
        params = {"modules": modules, "formatted": "false"}

        data = await self._get(url, params)
        if not data:
            return []

        result = data.get("quoteSummary", {}).get("result", [])
        if not result:
            return []

        key = "incomeStatementHistory" if period_type == "annual" else "incomeStatementHistoryQuarterly"
        statements = result[0].get(key, {}).get("incomeStatementHistory", [])

        financials = []
        for stmt in statements:
            date_str = stmt.get("endDate", {})
            if isinstance(date_str, dict):
                date_str = date_str.get("fmt", "")

            period = date_str[:4] if period_type == "annual" else date_str[:7]

            financials.append({
                "symbol": symbol,
                "period_type": period_type,
                "period": period,
                "revenue": clean_number(stmt.get("totalRevenue")),
                "gross_profit": clean_number(stmt.get("grossProfit")),
                "operating_income": clean_number(stmt.get("operatingIncome")),
                "net_income": clean_number(stmt.get("netIncome")),
                "eps": clean_number(stmt.get("basicEPS")),
                "source": "yahoo_scraper",
            })

        return financials

    # ============================================================
    # 获取市场数据（热力图用）
    # ============================================================
    async def get_market_data(self, market: str = "us", sector: str = None) -> List[Dict]:
        """获取市场热力图数据"""
        # 核心股票列表
        symbols = [
            "AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "TSLA",
            "BRK-B", "JPM", "V", "UNH", "XOM", "LLY", "JNJ", "PG",
            "MA", "HD", "AVGO", "MRK", "CVX", "ABBV", "COST", "PEP",
            "KO", "WMT", "TMO", "MCD", "CRM", "BAC", "ACN", "AMD",
            "QCOM", "INTC", "IBM", "ORCL", "NFLX", "DIS", "PYPL"
        ]

        # 批量获取行情
        url = f"{YAHOO_BASE}/v7/finance/quote"
        params = {"symbols": ",".join(symbols[:40])}
        data = await self._get(url, params)
        if not data:
            return []

        results = data.get("quoteResponse", {}).get("result", [])
        heatmap_data = []
        for q in results:
            heatmap_data.append({
                "symbol": q.get("symbol"),
                "name": q.get("shortName", q.get("longName", "")),
                "price": clean_number(q.get("regularMarketPrice")),
                "change_pct": clean_number(q.get("regularMarketChangePercent")),
                "market_cap": q.get("marketCap"),
                "volume": q.get("regularMarketVolume"),
                "sector": q.get("sector", "Technology"),
            })

        return heatmap_data
