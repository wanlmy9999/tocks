import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export type AIProvider = 'openai' | 'claude' | 'gemini' | 'local';

export interface AIRequest {
  provider?: AIProvider;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
}

export interface AIResponse {
  content: string;
  provider: string;
  tokens?: number;
}

@Injectable()
export class AiService {
  constructor(private configService: ConfigService) {}

  /**
   * 统一AI分析接口 - 自动降级
   */
  async analyze(req: AIRequest): Promise<AIResponse> {
    const provider = req.provider || this.getDefaultProvider();

    try {
      switch (provider) {
        case 'claude':
          return await this.callClaude(req);
        case 'gemini':
          return await this.callGemini(req);
        case 'local':
          return await this.callLocal(req);
        case 'openai':
        default:
          return await this.callOpenAI(req);
      }
    } catch (e) {
      console.error(`${provider} 调用失败，降级...`);
      // 自动降级
      if (provider !== 'local') {
        return this.callLocal(req).catch(() => ({
          content: '暂时无法获取AI分析，请稍后重试',
          provider: 'fallback',
        }));
      }
      throw e;
    }
  }

  /**
   * 股票情绪分析
   */
  async analyzeSentiment(texts: string[]): Promise<{
    positive: number;
    neutral: number;
    negative: number;
    summary: string;
  }> {
    const prompt = `分析以下文本的情绪倾向，返回JSON格式：
文本：${texts.slice(0, 10).join('\n---\n')}

请返回：
{
  "positive": 正面占比(0-100),
  "neutral": 中性占比(0-100),
  "negative": 负面占比(0-100),
  "summary": "中文情绪总结(50字内)"
}`;

    const response = await this.analyze({
      prompt,
      systemPrompt: '你是专业的金融情绪分析师，只返回JSON格式。',
      maxTokens: 300,
    });

    try {
      const json = response.content.match(/\{[\s\S]*\}/)?.[0];
      return json ? JSON.parse(json) : {
        positive: 33, neutral: 34, negative: 33, summary: '情绪中性'
      };
    } catch {
      return { positive: 33, neutral: 34, negative: 33, summary: '分析失败' };
    }
  }

  /**
   * 生成股票分析报告
   */
  async generateReport(data: {
    symbol: string;
    price: number;
    changePercent: number;
    marketCap: number;
    peRatio: number;
    sentiment: { positive: number; neutral: number; negative: number };
    newsCount: number;
  }): Promise<string> {
    const prompt = `
请为以下股票生成一份专业的中文分析报告（500字）：

股票代码：${data.symbol}
当前价格：$${data.price}
涨跌幅：${data.changePercent}%
市值：$${(data.marketCap / 1e9).toFixed(1)}B
市盈率：${data.peRatio || '暂无'}
市场情绪：正面${data.sentiment.positive}% 中性${data.sentiment.neutral}% 负面${data.sentiment.negative}%
近期新闻数：${data.newsCount}条

请包含：技术面分析、基本面分析、市场情绪、投资建议（风险提示）
`;

    const response = await this.analyze({
      prompt,
      systemPrompt: '你是资深的华尔街分析师，请用专业中文撰写分析报告。报告需客观、专业，包含风险提示。',
      maxTokens: 1000,
    });

    return response.content;
  }

  private getDefaultProvider(): AIProvider {
    if (this.configService.get('OPENAI_API_KEY')) return 'openai';
    if (this.configService.get('CLAUDE_API_KEY')) return 'claude';
    if (this.configService.get('GEMINI_API_KEY')) return 'gemini';
    return 'local';
  }

  private async callOpenAI(req: AIRequest): Promise<AIResponse> {
    const apiKey = this.configService.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OpenAI API Key未配置');

    const res = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          ...(req.systemPrompt ? [{ role: 'system', content: req.systemPrompt }] : []),
          { role: 'user', content: req.prompt },
        ],
        max_tokens: req.maxTokens || 1000,
        temperature: 0.7,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 30000,
      },
    );

    return {
      content: res.data.choices[0].message.content,
      provider: 'openai',
      tokens: res.data.usage?.total_tokens,
    };
  }

  private async callClaude(req: AIRequest): Promise<AIResponse> {
    const apiKey = this.configService.get('CLAUDE_API_KEY');
    if (!apiKey) throw new Error('Claude API Key未配置');

    const res = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-haiku-20240307',
        max_tokens: req.maxTokens || 1000,
        system: req.systemPrompt || '你是专业的金融分析助手',
        messages: [{ role: 'user', content: req.prompt }],
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );

    return {
      content: res.data.content[0].text,
      provider: 'claude',
    };
  }

  private async callGemini(req: AIRequest): Promise<AIResponse> {
    const apiKey = this.configService.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('Gemini API Key未配置');

    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: req.prompt }] }],
      },
      { timeout: 30000 },
    );

    return {
      content: res.data.candidates[0].content.parts[0].text,
      provider: 'gemini',
    };
  }

  private async callLocal(req: AIRequest): Promise<AIResponse> {
    const ollamaUrl = this.configService.get('OLLAMA_URL', 'http://localhost:11434');
    const model = this.configService.get('OLLAMA_MODEL', 'qwen2.5:7b');

    const res = await axios.post(
      `${ollamaUrl}/api/generate`,
      {
        model,
        prompt: `${req.systemPrompt ? req.systemPrompt + '\n\n' : ''}${req.prompt}`,
        stream: false,
      },
      { timeout: 60000 },
    );

    return {
      content: res.data.response,
      provider: `local:${model}`,
    };
  }
}
