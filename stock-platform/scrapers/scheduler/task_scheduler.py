"""
爬虫任务调度器 - APScheduler
"""
import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# 热门股票列表
HOT_SYMBOLS = [
    "NVDA", "AAPL", "MSFT", "TSLA", "META", "AMZN", "GOOGL",
    "AMD", "QCOM", "INTC", "NFLX", "JPM", "BAC", "V", "MA",
]

HOT_CIKS = [
    "0000102909",  # Berkshire
    "0001037389",  # Vanguard
    "0000315066",  # BlackRock
]


class TaskScheduler:
    """异步任务调度器"""

    def __init__(self):
        self.scheduler = AsyncIOScheduler(timezone="America/New_York")
        self._setup_jobs()

    def _setup_jobs(self):
        """配置定时任务"""

        # 1. 每5分钟更新热门股票行情（交易时段）
        self.scheduler.add_job(
            self.update_quotes,
            IntervalTrigger(minutes=5),
            id="update_quotes",
            max_instances=1,
            replace_existing=True,
        )

        # 2. 每日盘后更新K线数据（美东时间 17:00）
        self.scheduler.add_job(
            self.update_klines,
            CronTrigger(hour=17, minute=30, day_of_week="mon-fri"),
            id="update_klines",
            max_instances=1,
        )

        # 3. 每30分钟爬取新闻
        self.scheduler.add_job(
            self.crawl_news,
            IntervalTrigger(minutes=30),
            id="crawl_news",
            max_instances=1,
        )

        # 4. 每季度末更新机构13F（每季度最后一个月的最后一周）
        self.scheduler.add_job(
            self.update_institutions,
            CronTrigger(month="3,6,9,12", day="20-31", hour=8),
            id="update_institutions",
            max_instances=1,
        )

        # 5. 每日更新热力图数据（美东 9:35，开盘后5分钟）
        self.scheduler.add_job(
            self.update_heatmap,
            CronTrigger(hour=9, minute=35, day_of_week="mon-fri"),
            id="update_heatmap",
            max_instances=1,
        )

        logger.info("✅ 调度器任务配置完成")

    async def start(self):
        self.scheduler.start()
        logger.info("🚀 调度器已启动")

    async def stop(self):
        self.scheduler.shutdown()
        logger.info("⏹️ 调度器已停止")

    # ============================================================
    # 任务实现
    # ============================================================
    async def update_quotes(self):
        """更新实时行情"""
        logger.info(f"🔄 更新行情: {len(HOT_SYMBOLS)} 只股票")
        from spiders.stocks.yahoo_spider import YahooFinanceSpider
        from utils.database import DatabaseManager

        db = DatabaseManager()
        await db.connect()
        spider = YahooFinanceSpider()

        for symbol in HOT_SYMBOLS:
            try:
                quote = await spider.get_quote(symbol)
                if quote:
                    await db.save_quote(quote)
                await asyncio.sleep(0.5)
            except Exception as e:
                logger.error(f"行情更新失败 {symbol}: {e}")

        await db.disconnect()
        logger.info("✅ 行情更新完成")

    async def update_klines(self):
        """更新K线数据"""
        logger.info("🔄 更新K线数据")
        from spiders.stocks.yahoo_spider import YahooFinanceSpider
        from utils.database import DatabaseManager

        db = DatabaseManager()
        await db.connect()
        spider = YahooFinanceSpider()

        for symbol in HOT_SYMBOLS:
            for period in ["1d", "1w"]:
                try:
                    klines = await spider.get_klines(symbol, period, 100)
                    if klines:
                        await db.save_klines(symbol, period, klines)
                    await asyncio.sleep(1)
                except Exception as e:
                    logger.error(f"K线更新失败 {symbol}/{period}: {e}")

        await db.disconnect()
        logger.info("✅ K线更新完成")

    async def crawl_news(self):
        """爬取新闻"""
        logger.info("🔄 爬取新闻")
        from spiders.news.news_spider import NewsSpider
        from utils.database import DatabaseManager

        db = DatabaseManager()
        await db.connect()
        spider = NewsSpider()

        for symbol in HOT_SYMBOLS[:8]:
            try:
                news = await spider.get_news(symbol, 1, 10)
                if news:
                    await db.save_news(news)
                await asyncio.sleep(2)
            except Exception as e:
                logger.error(f"新闻爬取失败 {symbol}: {e}")

        await db.disconnect()
        logger.info("✅ 新闻爬取完成")

    async def update_institutions(self):
        """更新机构13F数据"""
        logger.info("🔄 更新机构持仓数据")
        from spiders.institutions.sec_spider import SECSpider
        from utils.database import DatabaseManager

        db = DatabaseManager()
        await db.connect()
        spider = SECSpider()

        for cik in HOT_CIKS:
            try:
                await spider.crawl_and_save(cik, db)
                await asyncio.sleep(5)  # SEC限速
            except Exception as e:
                logger.error(f"机构数据更新失败 CIK={cik}: {e}")

        await db.disconnect()
        logger.info("✅ 机构数据更新完成")

    async def update_heatmap(self):
        """更新热力图数据"""
        from spiders.stocks.yahoo_spider import YahooFinanceSpider
        from utils.database import DatabaseManager

        db = DatabaseManager()
        await db.connect()
        spider = YahooFinanceSpider()
        data = await spider.get_market_data()
        for item in data:
            if item.get('symbol') and item.get('price'):
                await db.save_quote({**item, 'symbol': item['symbol']})
        await db.disconnect()
