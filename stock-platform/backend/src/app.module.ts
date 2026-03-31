import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { StockModule } from './modules/stock/stock.module';
import { NewsModule } from './modules/news/news.module';
import { InstitutionModule } from './modules/institution/institution.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AiModule } from './modules/ai/ai.module';
import { HeatmapModule } from './modules/heatmap/heatmap.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USER', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        database: config.get('DB_NAME', 'stock_platform'),
        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 60,
    }),
    StockModule,
    NewsModule,
    InstitutionModule,
    ReportsModule,
    AiModule,
    HeatmapModule,
  ],
})
export class AppModule {}
