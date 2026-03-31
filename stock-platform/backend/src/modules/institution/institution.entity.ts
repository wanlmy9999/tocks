import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('institutions')
export class InstitutionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ nullable: true, length: 20, unique: true })
  cik: string;

  @Column({ length: 300 })
  name: string;

  @Column({ name: 'name_zh', length: 300, nullable: true })
  nameZh: string;

  @Column({ nullable: true, length: 100 })
  type: string;

  @Column({ nullable: true, type: 'bigint' })
  aum: number;

  @Column({ name: 'holdings_count', default: 0 })
  holdingsCount: number;

  @Column({ name: 'top_holding', nullable: true, length: 20 })
  topHolding: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ name: 'logo_url', nullable: true, length: 500 })
  logoUrl: string;

  @Column({ nullable: true, length: 300 })
  website: string;

  @Column({ name: 'report_date', nullable: true, type: 'date' })
  reportDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('holdings')
export class HoldingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'institution_id' })
  institutionId: string;

  @Index()
  @Column({ length: 20 })
  symbol: string;

  @Column({ name: 'name_of_issuer', nullable: true, length: 300 })
  nameOfIssuer: string;

  @Column({ type: 'bigint' })
  shares: number;

  @Column({ type: 'bigint' })
  value: number;

  @Column({ nullable: true, type: 'decimal', precision: 8, scale: 4 })
  weight: number;

  @Column({ nullable: true, length: 100 })
  sector: string;

  @Column({ name: 'report_date', type: 'date' })
  reportDate: Date;

  @Column({ name: 'prev_shares', nullable: true, type: 'bigint' })
  prevShares: number;

  @Column({ name: 'change_shares', nullable: true, type: 'bigint' })
  changeShares: number;

  @Column({ name: 'change_percent', nullable: true, type: 'decimal', precision: 10, scale: 4 })
  changePercent: number;

  @Column({ nullable: true, length: 20 })
  action: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
