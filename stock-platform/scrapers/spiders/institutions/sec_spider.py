"""
SEC EDGAR 13F 机构持仓爬虫
数据来源：https://www.sec.gov/cgi-bin/browse-edgar
"""
import asyncio
import logging
import xml.etree.ElementTree as ET
from typing import List, Dict, Optional, Any
from datetime import datetime
import aiohttp
import json
from utils.helpers import get_random_ua, clean_number

logger = logging.getLogger(__name__)

SEC_BASE = "https://data.sec.gov"
SEC_EDGAR = "https://www.sec.gov"


class SECSpider:
    """SEC EDGAR 13F 机构数据爬虫"""

    def __init__(self):
        self.headers = {
            "User-Agent": "StockAnalysisPlatform research@example.com",
            "Accept-Encoding": "gzip, deflate",
            "Accept": "application/json, text/html",
        }

    async def _get(self, url: str, as_text: bool = False) -> Optional[Any]:
        """GET请求"""
        async with aiohttp.ClientSession(headers=self.headers) as session:
            for attempt in range(3):
                try:
                    await asyncio.sleep(0.5)  # SEC限速要求
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                        if resp.status == 200:
                            if as_text:
                                return await resp.text()
                            return await resp.json(content_type=None)
                        elif resp.status == 429:
                            await asyncio.sleep(10)
                        else:
                            logger.warning(f"SEC API {resp.status}: {url}")
                            return None
                except Exception as e:
                    logger.error(f"SEC请求失败: {e}")
                    if attempt == 2:
                        return None
                    await asyncio.sleep(2 ** attempt)
        return None

    # ============================================================
    # 获取机构基本信息
    # ============================================================
    async def get_institution_info(self, cik: str) -> Optional[Dict]:
        """获取机构基本信息"""
        cik_padded = cik.zfill(10)
        url = f"{SEC_BASE}/submissions/CIK{cik_padded}.json"
        data = await self._get(url)
        if not data:
            return None

        return {
            "cik": cik,
            "name": data.get("name", ""),
            "entity_type": data.get("entityType", ""),
            "sic": data.get("sic", ""),
            "state": data.get("stateOfIncorporation", ""),
            "fiscal_year_end": data.get("fiscalYearEnd", ""),
        }

    # ============================================================
    # 获取最新13F申报文件
    # ============================================================
    async def get_latest_13f(self, cik: str) -> Optional[Dict]:
        """获取最新的13F-HR申报"""
        cik_padded = cik.zfill(10)
        url = f"{SEC_BASE}/submissions/CIK{cik_padded}.json"
        data = await self._get(url)
        if not data:
            return None

        filings = data.get("filings", {}).get("recent", {})
        forms = filings.get("form", [])
        accessions = filings.get("accessionNumber", [])
        dates = filings.get("filingDate", [])

        # 找最新的13F-HR
        for i, form in enumerate(forms):
            if form == "13F-HR":
                accession = accessions[i].replace("-", "")
                filing_date = dates[i]
                return {
                    "cik": cik,
                    "accession": accessions[i],
                    "filing_date": filing_date,
                    "url": f"{SEC_EDGAR}/Archives/edgar/data/{cik}/{accession}/",
                }

        return None

    # ============================================================
    # 解析13F持仓XML
    # ============================================================
    async def parse_holdings_xml(self, cik: str, accession: str) -> List[Dict]:
        """解析13F持仓XML文件"""
        accession_clean = accession.replace("-", "")
        # 获取文件索引
        index_url = f"{SEC_EDGAR}/Archives/edgar/data/{cik}/{accession_clean}/{accession}-index.htm"
        index_text = await self._get(index_url, as_text=True)

        # 找infotable.xml文件
        xml_url = None
        if index_text:
            for line in index_text.split("\n"):
                if "infotable.xml" in line.lower() or "form13fInfoTable" in line:
                    # 提取URL
                    import re
                    matches = re.findall(r'href="(/[^"]+\.xml)"', line, re.I)
                    if matches:
                        xml_url = f"{SEC_EDGAR}{matches[0]}"
                        break

        if not xml_url:
            # 尝试直接构建URL
            xml_url = f"{SEC_EDGAR}/Archives/edgar/data/{cik}/{accession_clean}/infotable.xml"

        xml_text = await self._get(xml_url, as_text=True)
        if not xml_text:
            return []

        return self._parse_xml(xml_text, cik, accession)

    # ============================================================
    # XML解析
    # ============================================================
    def _parse_xml(self, xml_text: str, cik: str, accession: str) -> List[Dict]:
        """解析13F XML持仓数据"""
        holdings = []
        try:
            # 处理命名空间
            xml_text = xml_text.replace('xmlns=', 'xmlnsx=')
            root = ET.fromstring(xml_text)

            # 确定季度
            filing_quarter = self._get_quarter()

            for info_table in root.iter("infoTable"):
                try:
                    name_el = info_table.find("nameOfIssuer")
                    shares_el = info_table.find("shrsOrPrnAmt/sshPrnamt")
                    value_el = info_table.find("value")
                    cusip_el = info_table.find("cusip")
                    class_el = info_table.find("titleOfClass")

                    if value_el is None:
                        continue

                    market_value = clean_number(value_el.text) or 0
                    # SEC 13F中value单位是1000美元
                    market_value_usd = market_value * 1000

                    holdings.append({
                        "company_name": name_el.text.strip() if name_el is not None else "",
                        "shares": int(shares_el.text.replace(",", "")) if shares_el is not None else 0,
                        "market_value": market_value_usd,
                        "cusip": cusip_el.text if cusip_el is not None else "",
                        "title_of_class": class_el.text if class_el is not None else "",
                        "filing_quarter": filing_quarter,
                        "cik": cik,
                        "accession": accession,
                    })
                except Exception as e:
                    logger.debug(f"解析持仓行失败: {e}")
                    continue

        except ET.ParseError as e:
            logger.error(f"XML解析失败: {e}")

        return holdings

    # ============================================================
    # CUSIP转股票代码
    # ============================================================
    async def cusip_to_symbol(self, cusip: str) -> Optional[str]:
        """通过CUSIP查询股票代码"""
        # 使用SEC EDGAR的CUSIP映射
        url = f"https://efts.sec.gov/LATEST/search-index?q=%22{cusip}%22&dateRange=custom&startdt=2024-01-01&forms=13F-HR"
        # 这里简化处理，实际需要建立CUSIP->Symbol的映射表
        return None

    # ============================================================
    # 完整爬取并保存
    # ============================================================
    async def crawl_and_save(self, cik: str, db) -> bool:
        """完整爬取SEC 13F并存入数据库"""
        logger.info(f"开始爬取机构: CIK={cik}")
        try:
            # 1. 获取机构信息
            info = await self.get_institution_info(cik)
            if info:
                await db.upsert_institution(info)

            # 2. 获取最新13F
            filing = await self.get_latest_13f(cik)
            if not filing:
                logger.warning(f"未找到13F文件: CIK={cik}")
                return False

            # 3. 解析持仓
            holdings = await self.parse_holdings_xml(cik, filing["accession"])
            if not holdings:
                logger.warning(f"持仓数据为空: CIK={cik}")
                return False

            # 4. 计算持仓占比
            total_value = sum(h["market_value"] for h in holdings)
            for h in holdings:
                h["portfolio_pct"] = (h["market_value"] / total_value * 100) if total_value > 0 else 0
                h["filing_date"] = filing["filing_date"]

            # 5. 存入数据库
            await db.save_holdings(cik, holdings)
            logger.info(f"✅ CIK={cik} 爬取完成，共{len(holdings)}条持仓")
            return True

        except Exception as e:
            logger.error(f"爬取失败: CIK={cik}, Error={e}")
            return False

    def _get_quarter(self) -> str:
        """获取当前季度标识"""
        now = datetime.now()
        quarter = (now.month - 1) // 3 + 1
        return f"{now.year}Q{quarter}"


# ============================================================
# 东方财富机构数据爬虫
# ============================================================
class EastMoneyInstitutionSpider:
    """东方财富机构研报爬虫"""

    BASE = "https://reportdodge.eastmoney.com"

    async def get_institution_reports(self, symbol: str) -> List[Dict]:
        """获取机构研报"""
        headers = {
            "User-Agent": get_random_ua(),
            "Referer": "https://www.eastmoney.com/",
        }
        url = f"https://reportdodge.eastmoney.com/api/ReportList/GetDataList"
        params = {
            "pageIndex": 1,
            "pageSize": 20,
            "reportType": 2,
            "industry": "",
            "searchKey": symbol,
        }

        async with aiohttp.ClientSession(headers=headers) as session:
            try:
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        data = await resp.json(content_type=None)
                        return data.get("data", {}).get("list", [])
            except Exception as e:
                logger.error(f"东方财富机构研报爬取失败: {e}")
        return []
