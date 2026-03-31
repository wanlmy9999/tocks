import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { StockEntity, QuoteEntity, KlineEntity } from './stock.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StockEntity, QuoteEntity, KlineEntity])],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
