import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { StocksController } from './stocks.controller';
import { StocksService } from './stocks.service';
import { Stock, Quote } from './stock.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Stock, Quote]),
    BullModule.registerQueue({ name: 'stocks' }),
  ],
  controllers: [StocksController],
  providers: [StocksService],
  exports: [StocksService],
})
export class StocksModule {}
