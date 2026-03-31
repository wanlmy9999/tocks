import {
  Controller, Get, Post, Query, Param, Body,
  HttpCode, HttpStatus, Logger, UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { StocksService } from './stocks.service';

@ApiTags('stocks')
@Controller('stocks')
export class StocksController {
  private readonly logger = new Logger(StocksController.name);

  constructor(private readonly stocksService: StocksService) {}

  /**
   * 搜索股票（支持中文/英文/代码）
   * GET /api/v1/stocks/search?q=英伟达
   */
  @Get('search')
  @ApiOperation({ summary: '搜索股票（支持中/英文/代码）' })
  @ApiQuery({ name: 'q', description: '搜索关键词', example: '英伟达' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  async search(
    @Query('q') query: string,
    @Query('limit') limit = 10,
  ) {
    if (!query || query.trim().length === 0) {
      return { data: [], total: 0 };
    }
    const results = await this.stocksService.search(query.trim(), +limit);
    return { data: results, total: results.length };
  }

  /**
   * 股票详情
   * GET /api/v1/stocks/:symbol
   */
  @Get(':symbol')
  @ApiOperation({ summary: '获取股票详情' })
  @ApiParam({ name: 'symbol', example: 'NVDA' })
  async getDetail(@Param('symbol') symbol: string) {
    const data = await this.stocksService.getStockDetail(symbol.toUpperCase());
    return { data };
  }

  /**
   * K线数据
   * GET /api/v1/stocks/:symbol/klines?period=1d&limit=300
   */
  @Get(':symbol/klines')
  @ApiOperation({ summary: '获取K线数据' })
  @ApiParam({ name: 'symbol', example: 'NVDA' })
  @ApiQuery({ name: 'period', enum: ['5m', '15m', '1h', '1d', '1w', '1m'], example: '1d' })
  @ApiQuery({ name: 'limit', required: false, example: 300 })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async getKlines(
    @Param('symbol') symbol: string,
    @Query('period') period = '1d',
    @Query('limit') limit = 300,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.stocksService.getKlines(
      symbol.toUpperCase(), period, from, to, +limit,
    );
    return { data, symbol, period };
  }

  /**
   * 实时行情
   * GET /api/v1/stocks/:symbol/quote
   */
  @Get(':symbol/quote')
  @ApiOperation({ summary: '获取实时行情' })
  async getQuote(@Param('symbol') symbol: string) {
    const data = await this.stocksService.refreshQuote(symbol.toUpperCase());
    return { data };
  }

  /**
   * 财务数据
   * GET /api/v1/stocks/:symbol/financials?type=annual
   */
  @Get(':symbol/financials')
  @ApiOperation({ summary: '获取财务数据' })
  @ApiQuery({ name: 'type', enum: ['annual', 'quarterly'], example: 'annual' })
  async getFinancials(
    @Param('symbol') symbol: string,
    @Query('type') type = 'annual',
  ) {
    const data = await this.stocksService.getFinancials(symbol.toUpperCase(), type);
    return { data };
  }
}
