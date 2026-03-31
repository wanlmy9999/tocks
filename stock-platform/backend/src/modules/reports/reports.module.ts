// reports.controller.ts
import {
  Controller, Post, Get, Param, Body, Res, Logger,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { ReportsService } from './reports.service';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { v4 as uuid } from 'uuid';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);
  private readonly jobs = new Map<string, { status: string; filePath?: string; error?: string }>();

  constructor(
    private readonly reportsService: ReportsService,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: '生成报告（异步）' })
  @ApiBody({ schema: { properties: { symbol: { type: 'string' }, format: { type: 'string' } } } })
  async generate(@Body() body: { symbol: string; format: string }) {
    const { symbol, format } = body;
    const jobId = uuid();
    this.jobs.set(jobId, { status: 'processing' });

    // Async generate
    this.reportsService
      .generateReport(symbol.toUpperCase(), format)
      .then((filePath) => {
        this.jobs.set(jobId, { status: 'done', filePath });
        // Persist to DB
        this.ds.query(
          `INSERT INTO reports (id, symbol, format, status, file_path) VALUES ($1,$2,$3,'done',$4)`,
          [jobId, symbol.toUpperCase(), format, filePath],
        ).catch(() => {});
      })
      .catch((err) => {
        this.logger.error(`Report generation failed: ${err.message}`);
        this.jobs.set(jobId, { status: 'failed', error: err.message });
      });

    return { data: { id: jobId, status: 'processing' } };
  }

  @Get(':id/status')
  @ApiOperation({ summary: '查询报告生成状态' })
  async getStatus(@Param('id') id: string) {
    const job = this.jobs.get(id);
    if (!job) {
      // Check DB
      const [row] = await this.ds.query(`SELECT * FROM reports WHERE id=$1`, [id]);
      if (row) return { data: { status: row.status, error_msg: row.error_msg } };
      return { data: { status: 'not_found' } };
    }
    return { data: { status: job.status, error_msg: job.error } };
  }

  @Get(':id/download')
  @ApiOperation({ summary: '下载报告文件' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const job = this.jobs.get(id);
    const filePath = job?.filePath;

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: '文件不存在或已过期' });
    }

    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).slice(1);
    const mimeMap: Record<string, string> = {
      md: 'text/markdown',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      pdf: 'application/pdf',
    };

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.sendFile(filePath);
  }
}

// reports.module.ts
import { Module } from '@nestjs/common';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
