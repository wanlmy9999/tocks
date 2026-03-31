import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { StockService } from './stock.service';

@ApiTags('股票')
@Controller('stocks')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('search')
  @ApiOperation({ summary: '搜索股票（支持中文/英文/代码）' })
  @ApiQuery({ name: 'q', description: '搜索关键词' })
  @ApiQuery({ name: 'limit', required: false })
  async search(@Query('q') query: string, @Query('limit') limit = 20) {
    return this.stockService.search(query, +limit);
  }

  @Get('top')
  @ApiOperation({ summary: '获取热门股票（热力图使用）' })
  @UseInterceptors(CacheInterceptor)
  async getTopStocks(@Query('limit') limit = 100) {
    return this.stockService.getTopStocks(+limit);
  }

  @Get(':symbol')
  @ApiOperation({ summary: '获取股票详情' })
  @ApiParam({ name: 'symbol', description: '股票代码' })
  async getDetail(@Param('symbol') symbol: string) {
    return this.stockService.getDetail(symbol.toUpperCase());
  }

  @Get(':symbol/quote')
  @ApiOperation({ summary: '获取实时行情' })
  async getQuote(@Param('symbol') symbol: string) {
    return this.stockService.getQuote(symbol.toUpperCase());
  }

  @Get(':symbol/kline')
  @ApiOperation({ summary: '获取K线数据' })
  @ApiQuery({ name: 'period', enum: ['1d', '1w', '1m', '3m', '1y'] })
  @ApiQuery({ name: 'limit', required: false })
  async getKline(
    @Param('symbol') symbol: string,
    @Query('period') period: string = '1d',
    @Query('limit') limit: number = 200,
  ) {
    return this.stockService.getKline(symbol.toUpperCase(), period, +limit);
  }

  @Get(':symbol/financials')
  @ApiOperation({ summary: '获取财务数据' })
  async getFinancials(@Param('symbol') symbol: string) {
    return this.stockService.getFinancials(symbol.toUpperCase());
  }
}
