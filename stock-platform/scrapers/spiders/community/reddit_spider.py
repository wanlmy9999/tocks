"""Reddit社区爬虫"""
import aiohttp, logging
from utils.helpers import get_random_ua, clean_text

logger = logging.getLogger(__name__)

class RedditSpider:
    async def get_comments(self, symbol: str, limit: int = 20):
        url = f"https://www.reddit.com/search.json"
        params = {"q": symbol + " stock", "sort": "new", "limit": limit, "type": "link"}
        headers = {"User-Agent": "StockAnalysis/1.0"}
        async with aiohttp.ClientSession(headers=headers) as session:
            try:
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        posts = []
                        for post in data.get("data",{}).get("children",[]):
                            d = post.get("data",{})
                            posts.append({
                                "symbol": symbol,
                                "platform": "reddit",
                                "platform_id": d.get("id"),
                                "username": d.get("author"),
                                "content": clean_text(d.get("title","")),
                                "upvotes": d.get("ups",0),
                                "url": f"https://reddit.com{d.get('permalink','')}",
                            })
                        return posts
            except Exception as e:
                logger.error(f"Reddit爬取失败: {e}")
        return []
