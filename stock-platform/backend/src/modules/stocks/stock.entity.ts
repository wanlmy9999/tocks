// ============================================================
// stocks.entity.ts
// ============================================================
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index
} from 'typeorm';

@Entity('stocks')
export class Stock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  symbol: string;

  @Column({ name: 'name_en' })
  nameEn: string;

  @Column({ name: 'name_zh', nullable: true })
  nameZh: string;

  @Column({ nullable: true })
  exchange: string;

  @Column({ nullable: true })
  sector: string;

  @Column({ nullable: true })
  industry: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  website: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'bigint', nullable: true })
  employees: number;

  @Column({ name: 'logo_url', nullable: true })
  logoUrl: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

// ============================================================
// quote.entity.ts
// ============================================================
@Entity('quotes')
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  symbol: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  price: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  open: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  high: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  low: number;

  @Column({ name: 'prev_close', type: 'decimal', precision: 18, scale: 4, nullable: true })
  prevClose: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  change: number;

  @Column({ name: 'change_pct', type: 'decimal', precision: 8, scale: 4, nullable: true })
  changePct: number;

  @Column({ type: 'bigint', nullable: true })
  volume: number;

  @Column({ name: 'market_cap', type: 'decimal', precision: 20, scale: 2, nullable: true })
  marketCap: number;

  @Column({ name: 'pe_ratio', type: 'decimal', precision: 10, scale: 2, nullable: true })
  peRatio: number;

  @Column({ name: 'week_52_high', type: 'decimal', precision: 18, scale: 4, nullable: true })
  week52High: number;

  @Column({ name: 'week_52_low', type: 'decimal', precision: 18, scale: 4, nullable: true })
  week52Low: number;

  @Column({ name: 'avg_volume', type: 'bigint', nullable: true })
  avgVolume: number;

  @Column({ nullable: true })
  source: string;

  @Column({ name: 'quoted_at', type: 'timestamptz', default: () => 'NOW()' })
  quotedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
