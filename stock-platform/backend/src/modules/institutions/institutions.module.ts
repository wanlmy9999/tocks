// institutions.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { InstitutionsService } from './institutions.service';

@ApiTags('institutions')
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly svc: InstitutionsService) {}

  @Get('top')
  @ApiOperation({ summary: '获取热门机构（首页展示）' })
  @ApiQuery({ name: 'limit', required: false, example: 6 })
  async getTop(@Query('limit') limit = 6) {
    const data = await this.svc.getTopInstitutions(+limit);
    return { data };
  }

  @Get('ranking')
  @ApiOperation({ summary: '机构排行榜' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  async getRanking(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('sortBy') sortBy = 'aum',
  ) {
    return this.svc.getRanking(+page, +pageSize, sortBy);
  }

  @Get(':id')
  @ApiOperation({ summary: '机构详情' })
  @ApiParam({ name: 'id' })
  async getDetail(@Param('id') id: string) {
    const data = await this.svc.getDetail(id);
    return { data };
  }

  @Get(':id/holdings')
  @ApiOperation({ summary: '机构持仓列表（分页）' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortDir', required: false })
  async getHoldings(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('search') search = '',
    @Query('sortBy') sortBy = 'market_value',
    @Query('sortDir') sortDir: 'ASC' | 'DESC' = 'DESC',
  ) {
    return this.svc.getHoldings(id, +page, +pageSize, search, sortBy, sortDir);
  }
}

// institutions.module.ts
import { Module } from '@nestjs/common';

@Module({
  controllers: [InstitutionsController],
  providers: [InstitutionsService],
  exports: [InstitutionsService],
})
export class InstitutionsModule {}
