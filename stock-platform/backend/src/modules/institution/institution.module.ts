import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstitutionController } from './institution.controller';
import { InstitutionService } from './institution.service';
import { InstitutionEntity, HoldingEntity } from './institution.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InstitutionEntity, HoldingEntity])],
  controllers: [InstitutionController],
  providers: [InstitutionService],
  exports: [InstitutionService],
})
export class InstitutionModule {}
