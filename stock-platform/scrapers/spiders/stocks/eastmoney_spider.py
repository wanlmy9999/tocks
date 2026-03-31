"""东方财富股票搜索爬虫"""
import aiohttp
import logging
from utils.helpers import get_random_ua

logger = logging.getLogger(__name__)

class EastMoneySpider:
    async def search(self, query: str, limit: int = 10):
        url = "https://searchapi.eastmoney.com/api/suggest/get"
        params = {"input": query, "type": "14,15", "token": "D43BF722C8E33BDC906FB84D85E326AB", "count": limit}
        headers = {"User-Agent": get_random_ua(), "Referer": "https://www.eastmoney.com/"}
        async with aiohttp.ClientSession(headers=headers) as session:
            try:
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                    if resp.status == 200:
                        data = await resp.json(content_type=None)
                        results = []
                        for item in data.get("QuotationCodeTable", {}).get("Data", []):
                            results.append({
                                "symbol": item.get("Code", ""),
                                "name_zh": item.get("Name", ""),
                                "name_en": item.get("Name", ""),
                                "exchange": item.get("MktNum", ""),
                                "sector": "",
                            })
                        return results[:limit]
            except Exception as e:
                logger.error(f"东方财富搜索失败: {e}")
        return []
