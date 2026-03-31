import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('stocks')
export class StockEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ unique: true, length: 20 })
  symbol: string;

  @Column({ name: 'name_en', length: 200 })
  nameEn: string;

  @Index()
  @Column({ name: 'name_zh', length: 200, nullable: true })
  nameZh: string;

  @Column({ nullable: true, length: 20 })
  exchange: string;

  @Column({ nullable: true, length: 100 })
  sector: string;

  @Column({ nullable: true, length: 200 })
  industry: string;

  @Column({ name: 'market_cap', type: 'bigint', nullable: true })
  marketCap: number;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ name: 'logo_url', nullable: true, length: 500 })
  logoUrl: string;

  @Column({ nullable: true, length: 300 })
  website: string;

  @Column({ nullable: true, length: 50, default: 'US' })
  country: string;

  @Column({ nullable: true, length: 10, default: 'USD' })
  currency: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('quotes')
export class QuoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 20 })
  symbol: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  price: number;

  @Column({ nullable: true, type: 'decimal', precision: 18, scale: 4 })
  open: number;

  @Column({ nullable: true, type: 'decimal', precision: 18, scale: 4 })
  high: number;

  @Column({ nullable: true, type: 'decimal', precision: 18, scale: 4 })
  low: number;

  @Column({ name: 'prev_close', nullable: true, type: 'decimal', precision: 18, scale: 4 })
  prevClose: number;

  @Column({ nullable: true, type: 'decimal', precision: 18, scale: 4 })
  change: number;

  @Column({ name: 'change_percent', nullable: true, type: 'decimal', precision: 10, scale: 4 })
  changePercent: number;

  @Column({ nullable: true, type: 'bigint' })
  volume: number;

  @Column({ name: 'market_cap', nullable: true, type: 'bigint' })
  marketCap: number;

  @Column({ name: 'pe_ratio', nullable: true, type: 'decimal', precision: 12, scale: 4 })
  peRatio: number;

  @Column({ name: 'week_52_high', nullable: true, type: 'decimal', precision: 18, scale: 4 })
  week52High: number;

  @Column({ name: 'week_52_low', nullable: true, type: 'decimal', precision: 18, scale: 4 })
  week52Low: number;

  @Column({ nullable: true, length: 50 })
  source: string;

  @CreateDateColumn()
  timestamp: Date;
}

@Entity('kline')
export class KlineEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 20 })
  symbol: string;

  @Column({ length: 10 })
  period: string;

  @Column({ name: 'open_time', type: 'timestamp' })
  openTime: Date;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  open: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  high: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  low: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  close: number;

  @Column({ type: 'bigint' })
  volume: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
