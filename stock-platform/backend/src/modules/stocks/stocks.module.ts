import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StocksController } from './stocks.controller';
import { StocksService } from './stocks.service';
import { Stock, Quote } from './stock.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Stock, Quote]),
  ],
  controllers: [StocksController],
  providers: [StocksService],
  exports: [StocksService],
})
export class StocksModule {}
