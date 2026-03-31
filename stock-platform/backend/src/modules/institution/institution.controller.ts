import { Controller, Get, Param, Query, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InstitutionService } from './institution.service';

@ApiTags('机构追踪')
@Controller('institutions')
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  @Get('top')
  @ApiOperation({ summary: '首页热门机构（6个）' })
  async getTop(@Query('limit') limit = 6) {
    return this.institutionService.getTopInstitutions(+limit);
  }

  @Get('ranking')
  @ApiOperation({ summary: '机构排行榜（分页）' })
  async getRanking(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.institutionService.getRanking(+page, +limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '机构详情' })
  async getDetail(@Param('id') id: string) {
    return this.institutionService.getDetail(id);
  }

  @Get(':id/holdings')
  @ApiOperation({ summary: '机构持仓列表（分页+排序+搜索）' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['value', 'weight', 'shares', 'change_percent'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiQuery({ name: 'search', required: false })
  async getHoldings(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('sortBy') sortBy = 'value',
    @Query('sortOrder') sortOrder: 'ASC' | 'DESC' = 'DESC',
    @Query('search') search?: string,
  ) {
    return this.institutionService.getHoldings(id, +page, +limit, sortBy, sortOrder, search);
  }

  @Get(':id/sectors')
  @ApiOperation({ summary: '行业配置饼图数据' })
  async getSectors(@Param('id') id: string) {
    return this.institutionService.getSectorAllocation(id);
  }

  @Get(':id/changes')
  @ApiOperation({ summary: '增减仓变动' })
  async getChanges(
    @Param('id') id: string,
    @Query('action') action?: string,
  ) {
    return this.institutionService.getChanges(id, action);
  }

  @Post('sync/:cik')
  @ApiOperation({ summary: '同步SEC 13F数据' })
  async syncSEC(@Param('cik') cik: string) {
    return this.institutionService.syncSEC13F(cik);
  }
}
