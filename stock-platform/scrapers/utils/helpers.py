"""
爬虫工具函数库
"""
import random
import hashlib
import re
import logging
from typing import Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

# ============================================================
# User-Agent池
# ============================================================
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
]


def get_random_ua() -> str:
    """随机获取User-Agent"""
    return random.choice(USER_AGENTS)


def clean_number(value: Any) -> Optional[float]:
    """清洗数字，处理各种格式"""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, dict):
        # Yahoo Finance格式: {"raw": 123456}
        return float(value.get("raw", 0) or 0)
    try:
        cleaned = re.sub(r'[,$%\s]', '', str(value))
        if cleaned.endswith('B'):
            return float(cleaned[:-1]) * 1e9
        if cleaned.endswith('M'):
            return float(cleaned[:-1]) * 1e6
        if cleaned.endswith('K'):
            return float(cleaned[:-1]) * 1e3
        if cleaned.endswith('T'):
            return float(cleaned[:-1]) * 1e12
        return float(cleaned) if cleaned else None
    except (ValueError, TypeError):
        return None


def clean_text(text: Any) -> str:
    """清洗文本"""
    if not text:
        return ""
    text = str(text).strip()
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    return text[:5000]  # 限制长度


def hash_content(content: str) -> str:
    """内容hash，用于去重"""
    return hashlib.md5(content.encode('utf-8')).hexdigest()


def parse_date(date_str: Any) -> Optional[str]:
    """解析各种日期格式为ISO字符串"""
    if not date_str:
        return None
    if isinstance(date_str, datetime):
        return date_str.isoformat()
    
    formats = [
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%dT%H:%M:%SZ',
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%d',
        '%Y/%m/%d',
        '%m/%d/%Y',
        '%d %b %Y',
    ]
    for fmt in formats:
        try:
            return datetime.strptime(str(date_str), fmt).isoformat()
        except (ValueError, TypeError):
            continue
    return None


def retry_async(max_attempts: int = 3, delay: float = 1.0):
    """异步重试装饰器"""
    import asyncio
    import functools
    
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    if attempt < max_attempts - 1:
                        wait = delay * (2 ** attempt)
                        logger.warning(f"重试 {attempt+1}/{max_attempts}，等待{wait:.1f}s: {e}")
                        await asyncio.sleep(wait)
            raise last_error
        return wrapper
    return decorator


def setup_logger(name: str, level: str = "INFO") -> logging.Logger:
    """配置日志"""
    log = logging.getLogger(name)
    if not log.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(
            '%(asctime)s [%(name)s] %(levelname)s: %(message)s',
            datefmt='%H:%M:%S'
        ))
        log.addHandler(handler)
    log.setLevel(getattr(logging, level.upper(), logging.INFO))
    return log
