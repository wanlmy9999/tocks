import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { HeatmapService } from './heatmap.service';

@ApiTags('heatmap')
@Controller('heatmap')
export class HeatmapController {
  constructor(private readonly svc: HeatmapService) {}

  @Get()
  @ApiOperation({ summary: '获取热力图数据' })
  @ApiQuery({ name: 'market', enum: ['us', 'hk', 'cn'], required: false })
  @ApiQuery({ name: 'sector', required: false })
  async getHeatmap(@Query('market') market = 'us', @Query('sector') sector?: string) {
    const data = await this.svc.getHeatmapData(market, sector);
    return { data };
  }

  @Get('sectors')
  @ApiOperation({ summary: '获取行业列表' })
  async getSectors() {
    const data = await this.svc.getSectors();
    return { data };
  }
}
