"""
新闻爬虫 - 多源新闻聚合
数据源：Yahoo Finance新闻、东方财富、新浪财经
"""
import asyncio
import hashlib
import logging
import re
from typing import List, Dict, Optional
from datetime import datetime
import aiohttp
from bs4 import BeautifulSoup
from utils.helpers import get_random_ua, clean_text

logger = logging.getLogger(__name__)


class NewsSpider:
    """多源新闻爬虫"""

    def __init__(self):
        self.sources = [
            YahooNewsSpider(),
            SinaFinanceSpider(),
            EastMoneyNewsSpider(),
        ]

    async def get_news(self, symbol: str, page: int = 1, limit: int = 20) -> List[Dict]:
        """并发获取多源新闻"""
        tasks = [source.get_news(symbol, page, limit) for source in self.sources]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_news = []
        for result in results:
            if isinstance(result, list):
                all_news.extend(result)
            elif isinstance(result, Exception):
                logger.warning(f"新闻爬取失败: {result}")

        # 去重（基于标题hash）
        seen_hashes = set()
        unique_news = []
        for n in all_news:
            h = hashlib.md5(n.get("title", "").encode()).hexdigest()
            if h not in seen_hashes:
                seen_hashes.add(h)
                n["content_hash"] = h
                unique_news.append(n)

        # 按时间排序
        unique_news.sort(key=lambda x: x.get("published_at", ""), reverse=True)
        return unique_news[: limit]


class YahooNewsSpider:
    """Yahoo Finance新闻爬虫"""

    async def get_news(self, symbol: str, page: int = 1, limit: int = 20) -> List[Dict]:
        url = f"https://query1.finance.yahoo.com/v1/finance/search"
        params = {
            "q": symbol,
            "newsCount": limit,
            "quotesCount": 0,
            "enableFuzzyQuery": False,
        }
        headers = {
            "User-Agent": get_random_ua(),
            "Referer": "https://finance.yahoo.com/",
        }

        async with aiohttp.ClientSession(headers=headers) as session:
            try:
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status != 200:
                        return []
                    data = await resp.json(content_type=None)

                news_list = []
                for item in data.get("news", []):
                    pub_time = item.get("providerPublishTime")
                    news_list.append({
                        "symbol": symbol,
                        "title": clean_text(item.get("title", "")),
                        "summary": clean_text(item.get("summary", "")),
                        "source": item.get("publisher", "Yahoo Finance"),
                        "source_url": item.get("link", ""),
                        "image_url": item.get("thumbnail", {}).get("resolutions", [{}])[0].get("url", "") if item.get("thumbnail") else "",
                        "language": "en",
                        "published_at": datetime.utcfromtimestamp(pub_time).isoformat() if pub_time else None,
                        "crawled_at": datetime.utcnow().isoformat(),
                    })
                return news_list
            except Exception as e:
                logger.error(f"Yahoo新闻爬取失败: {e}")
                return []


class SinaFinanceSpider:
    """新浪财经新闻爬虫（中文）"""

    async def get_news(self, symbol: str, page: int = 1, limit: int = 20) -> List[Dict]:
        # 新浪财经搜索接口
        url = "https://feed.mix.sina.com.cn/api/roll/get"
        params = {
            "pageid": "153",
            "lid": "1686",
            "k": symbol,
            "num": limit,
            "page": page,
        }
        headers = {
            "User-Agent": get_random_ua(),
            "Referer": "https://finance.sina.com.cn/",
        }

        async with aiohttp.ClientSession(headers=headers) as session:
            try:
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status != 200:
                        return []
                    data = await resp.json(content_type=None)

                news_list = []
                for item in data.get("result", {}).get("data", []):
                    news_list.append({
                        "symbol": symbol,
                        "title": clean_text(item.get("title", "")),
                        "summary": clean_text(item.get("intro", "")),
                        "source": "新浪财经",
                        "source_url": item.get("url", ""),
                        "image_url": item.get("img", ""),
                        "language": "zh",
                        "published_at": datetime.fromtimestamp(
                            int(item.get("ctime", 0))
                        ).isoformat() if item.get("ctime") else None,
                        "crawled_at": datetime.utcnow().isoformat(),
                    })
                return news_list
            except Exception as e:
                logger.error(f"新浪财经新闻爬取失败: {e}")
                return []


class EastMoneyNewsSpider:
    """东方财富新闻爬虫（中文）"""

    async def get_news(self, symbol: str, page: int = 1, limit: int = 20) -> List[Dict]:
        # 东方财富资讯接口
        url = "https://np-anotice-stock.eastmoney.com/api/security/ann"
        params = {
            "sr": -1,
            "page_size": limit,
            "page_index": page,
            "ann_type": "A",
            "client_source": "web",
            "stock_list": symbol,
        }
        headers = {
            "User-Agent": get_random_ua(),
            "Referer": "https://www.eastmoney.com/",
        }

        async with aiohttp.ClientSession(headers=headers) as session:
            try:
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status != 200:
                        return []
                    data = await resp.json(content_type=None)

                news_list = []
                for item in data.get("data", {}).get("list", []):
                    news_list.append({
                        "symbol": symbol,
                        "title": clean_text(item.get("title", "")),
                        "source": "东方财富",
                        "source_url": f"https://notice.eastmoney.com/annex/{item.get('id')}.html",
                        "language": "zh",
                        "published_at": item.get("notice_date"),
                        "crawled_at": datetime.utcnow().isoformat(),
                    })
                return news_list
            except Exception as e:
                logger.error(f"东方财富新闻爬取失败: {e}")
                return []


# ============================================================
# Playwright动态爬虫（处理JS渲染页面）
# ============================================================
class DynamicNewsSpider:
    """Playwright动态新闻爬虫"""

    async def get_reuters_news(self, symbol: str) -> List[Dict]:
        """Reuters新闻（需要Playwright）"""
        from playwright.async_api import async_playwright

        news_list = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox"],
            )
            try:
                context = await browser.new_context(
                    user_agent=get_random_ua(),
                    viewport={"width": 1280, "height": 720},
                )
                page = await context.new_page()

                url = f"https://www.reuters.com/search/news?query={symbol}+stock"
                await page.goto(url, wait_until="networkidle", timeout=30000)
                await asyncio.sleep(2)

                articles = await page.query_selector_all("article.search-result")
                for article in articles[:10]:
                    title_el = await article.query_selector("h3.search-result-title")
                    link_el = await article.query_selector("a")
                    time_el = await article.query_selector("time")

                    if title_el:
                        title = await title_el.text_content()
                        href = await link_el.get_attribute("href") if link_el else ""
                        pub_time = await time_el.get_attribute("datetime") if time_el else None

                        news_list.append({
                            "symbol": symbol,
                            "title": clean_text(title),
                            "source": "Reuters",
                            "source_url": f"https://www.reuters.com{href}",
                            "language": "en",
                            "published_at": pub_time,
                            "crawled_at": datetime.utcnow().isoformat(),
                        })
            finally:
                await browser.close()

        return news_list
