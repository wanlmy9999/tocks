"""
股票分析平台 - Python爬虫服务
FastAPI + aiohttp + Playwright
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from spiders.stocks.yahoo_spider import YahooFinanceSpider
from spiders.stocks.eastmoney_spider import EastMoneySpider
from spiders.news.news_spider import NewsSpider
from spiders.institutions.sec_spider import SECSpider
from spiders.community.reddit_spider import RedditSpider
from scheduler.task_scheduler import TaskScheduler
from utils.database import DatabaseManager
from utils.logger import setup_logger

logger = setup_logger(__name__)
db = DatabaseManager()
scheduler = TaskScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info("🚀 爬虫服务启动...")
    await db.connect()
    await scheduler.start()
    yield
    await scheduler.stop()
    await db.disconnect()
    logger.info("✅ 爬虫服务关闭")


app = FastAPI(
    title="股票分析平台 - 爬虫服务",
    description="高并发股票数据爬虫系统",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# 股票搜索接口
# ============================================================
@app.get("/search")
async def search_stocks(q: str, limit: int = 10):
    """搜索股票（中文/英文/代码）"""
    if not q:
        return {"data": []}
    spider = EastMoneySpider()
    try:
        results = await spider.search(q, limit)
        return {"data": results, "query": q}
    except Exception as e:
        logger.error(f"搜索失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# 股票详情接口
# ============================================================
@app.get("/stocks/{symbol}")
async def get_stock_detail(symbol: str):
    """获取股票详情"""
    spider = YahooFinanceSpider()
    try:
        data = await spider.get_stock_detail(symbol.upper())
        if data:
            await db.upsert_stock(data)
        return {"data": data}
    except Exception as e:
        logger.error(f"获取股票详情失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# 实时行情接口
# ============================================================
@app.get("/quote/{symbol}")
async def get_quote(symbol: str):
    """获取实时行情"""
    spider = YahooFinanceSpider()
    try:
        data = await spider.get_quote(symbol.upper())
        if data:
            await db.save_quote(data)
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# K线数据接口
# ============================================================
@app.get("/klines/{symbol}")
async def get_klines(symbol: str, period: str = "1d", limit: int = 300):
    """获取K线数据"""
    spider = YahooFinanceSpider()
    try:
        data = await spider.get_klines(symbol.upper(), period, limit)
        if data:
            await db.save_klines(symbol.upper(), period, data)
        return {"data": data, "symbol": symbol, "period": period}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# 新闻接口
# ============================================================
@app.get("/news/{symbol}")
async def get_news(symbol: str, page: int = 1, limit: int = 20):
    """获取股票新闻"""
    spider = NewsSpider()
    try:
        data = await spider.get_news(symbol.upper(), page, limit)
        return {"data": data, "symbol": symbol}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# 机构SEC 13F接口
# ============================================================
@app.get("/institutions/sec/{cik}")
async def get_sec_13f(cik: str, background_tasks: BackgroundTasks):
    """爬取SEC 13F机构持仓数据"""
    spider = SECSpider()
    background_tasks.add_task(spider.crawl_and_save, cik, db)
    return {"success": True, "message": f"SEC 13F爬取任务已启动: CIK={cik}"}


# ============================================================
# 热力图数据接口
# ============================================================
@app.get("/heatmap")
async def get_heatmap_data(market: str = "us", sector: str = None):
    """获取热力图数据"""
    spider = YahooFinanceSpider()
    try:
        data = await spider.get_market_data(market, sector)
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# 社区情绪接口
# ============================================================
@app.get("/community/{symbol}")
async def get_community(symbol: str, platform: str = "all"):
    """获取社区评论"""
    spider = RedditSpider()
    try:
        data = await spider.get_comments(symbol.upper())
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# 财务数据接口
# ============================================================
@app.get("/financials/{symbol}")
async def get_financials(symbol: str, type: str = "annual"):
    """获取财务数据"""
    spider = YahooFinanceSpider()
    try:
        data = await spider.get_financials(symbol.upper(), type)
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# 健康检查
# ============================================================
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "scraper"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
