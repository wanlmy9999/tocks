"""
AI分析服务 - 统一接口
支持：OpenAI / Anthropic Claude / Google Gemini / Ollama本地模型
"""
import os
import logging
import json
from typing import Optional, Dict, List, Any
import aiohttp

logger = logging.getLogger(__name__)


class AIServiceFactory:
    """AI服务工厂"""

    @staticmethod
    def create(provider: str = None) -> "BaseAIProvider":
        provider = provider or os.getenv("AI_PROVIDER", "openai")
        providers = {
            "openai": OpenAIProvider,
            "claude": ClaudeProvider,
            "gemini": GeminiProvider,
            "ollama": OllamaProvider,
        }
        cls = providers.get(provider, OpenAIProvider)
        return cls()


class BaseAIProvider:
    """AI提供商基类"""

    async def analyze(self, prompt: str, system: str = None) -> str:
        raise NotImplementedError

    async def analyze_sentiment(self, texts: List[str]) -> Dict:
        """情绪分析"""
        combined = "\n".join([f"- {t}" for t in texts[:20]])
        prompt = f"""分析以下股票相关文本的整体情绪倾向，返回JSON格式：

文本列表：
{combined}

请返回：
{{
  "positive": 60,  // 积极情绪百分比
  "neutral": 25,   // 中性情绪百分比
  "negative": 15,  // 消极情绪百分比
  "summary": "整体市场情绪偏积极...",
  "keywords": ["上涨", "利好", "突破"]
}}

只返回JSON，不要其他内容。"""

        try:
            result = await self.analyze(prompt)
            # 清理JSON
            result = result.strip()
            if result.startswith("```"):
                result = result.split("```")[1]
                if result.startswith("json"):
                    result = result[4:]
            return json.loads(result)
        except Exception as e:
            logger.error(f"情绪分析失败: {e}")
            return {"positive": 33, "neutral": 34, "negative": 33, "summary": "分析失败", "keywords": []}

    async def generate_report_summary(self, stock_data: Dict) -> str:
        """生成股票分析摘要"""
        symbol = stock_data.get("symbol", "")
        price = stock_data.get("price", 0)
        change_pct = stock_data.get("change_pct", 0)

        prompt = f"""你是专业的股票分析师。请基于以下数据生成一份简洁的投资分析摘要（300字以内，中文）：

股票：{symbol}
当前价格：${price}
涨跌幅：{change_pct}%
市场情绪：{stock_data.get('sentiment', {})}
财务数据：{stock_data.get('financials', [])}

要求：
1. 分析当前技术面和基本面
2. 指出主要风险和机会
3. 给出客观的市场展望
4. 声明不构成投资建议

直接输出分析内容，不要标题。"""

        return await self.analyze(prompt)


class OpenAIProvider(BaseAIProvider):
    """OpenAI GPT提供商"""

    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY", "")
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.base_url = "https://api.openai.com/v1"

    async def analyze(self, prompt: str, system: str = None) -> str:
        if not self.api_key:
            return "⚠️ OpenAI API Key未配置"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 2000,
        }

        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as resp:
                    data = await resp.json()
                    if resp.status == 200:
                        return data["choices"][0]["message"]["content"]
                    else:
                        logger.error(f"OpenAI API错误: {data}")
                        return f"AI分析失败: {data.get('error', {}).get('message', '未知错误')}"
            except Exception as e:
                logger.error(f"OpenAI请求失败: {e}")
                return "AI服务暂时不可用"


class ClaudeProvider(BaseAIProvider):
    """Anthropic Claude提供商"""

    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY", "")
        self.model = os.getenv("CLAUDE_MODEL", "claude-3-haiku-20240307")
        self.base_url = "https://api.anthropic.com/v1"

    async def analyze(self, prompt: str, system: str = None) -> str:
        if not self.api_key:
            return "⚠️ Anthropic API Key未配置"

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "max_tokens": 2000,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            payload["system"] = system

        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    f"{self.base_url}/messages",
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as resp:
                    data = await resp.json()
                    if resp.status == 200:
                        return data["content"][0]["text"]
                    else:
                        logger.error(f"Claude API错误: {data}")
                        return "AI分析失败"
            except Exception as e:
                logger.error(f"Claude请求失败: {e}")
                return "AI服务暂时不可用"


class GeminiProvider(BaseAIProvider):
    """Google Gemini提供商"""

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "")
        self.model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    async def analyze(self, prompt: str, system: str = None) -> str:
        if not self.api_key:
            return "⚠️ Gemini API Key未配置"

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 2000},
        }

        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    data = await resp.json()
                    if resp.status == 200:
                        return data["candidates"][0]["content"]["parts"][0]["text"]
                    return "Gemini分析失败"
            except Exception as e:
                logger.error(f"Gemini请求失败: {e}")
                return "AI服务暂时不可用"


class OllamaProvider(BaseAIProvider):
    """本地Ollama模型提供商"""

    def __init__(self):
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

    async def analyze(self, prompt: str, system: str = None) -> str:
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3},
        }
        if system:
            payload["system"] = system

        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    f"{self.base_url}/api/generate",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=120),
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get("response", "")
                    return "Ollama分析失败"
            except Exception as e:
                logger.error(f"Ollama请求失败: {e}")
                return "本地AI服务不可用，请确保Ollama已启动"
