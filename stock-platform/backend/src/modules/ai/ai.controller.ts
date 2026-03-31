import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AiService } from './ai.service';

@ApiTags('AI分析')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'AI分析（支持OpenAI/Claude/Gemini/本地）' })
  async analyze(@Body() body: { prompt: string; provider?: string; systemPrompt?: string }) {
    return this.aiService.analyze(body as any);
  }

  @Post('sentiment')
  @ApiOperation({ summary: '批量情绪分析' })
  async sentiment(@Body() body: { texts: string[] }) {
    return this.aiService.analyzeSentiment(body.texts);
  }

  @Post('report')
  @ApiOperation({ summary: '生成股票分析报告' })
  async report(@Body() data: any) {
    const text = await this.aiService.generateReport(data);
    return { report: text };
  }
}
