# 🚀 股票分析平台 - 项目启动方案

## 一、架构概览

```
┌─────────────────────────────────────────────────────┐
│                   用户浏览器                          │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│          前端层 (Next.js 14 + TypeScript)             │
│  搜索 | 详情 | K线 | 热力图 | 机构 | 报告下载          │
└──────────────────────┬──────────────────────────────┘
                       ↓ REST / WebSocket
┌─────────────────────────────────────────────────────┐
│            BFF层 (NestJS + TypeScript)                │
│  Controller → Service → Repository                   │
└──────┬────────────┬──────────────┬──────────────────┘
       ↓            ↓              ↓
┌──────────┐  ┌──────────┐  ┌──────────────┐
│ 爬虫系统  │  │  AI系统   │  │  文件生成服务  │
│ (Python)  │  │ (多模型)   │  │ md/xlsx/pptx │
└──────────┘  └──────────┘  └──────────────┘
       ↓            ↓
┌─────────────────────────┐
│    数据层                 │
│  PostgreSQL + Redis      │
└─────────────────────────┘
```

## 二、项目目录结构

```
stock-platform/
├── frontend/                    # Next.js前端
│   ├── src/
│   │   ├── app/                 # App Router页面
│   │   │   ├── page.tsx         # 首页（热力图+搜索）
│   │   │   ├── stock/[symbol]/  # 股票详情页
│   │   │   ├── heatmap/         # 热力图页
│   │   │   ├── institutions/    # 机构追踪
│   │   │   └── report/          # 报告下载
│   │   ├── components/          # 共用组件
│   │   │   ├── charts/          # 图表组件
│   │   │   │   ├── KLineChart.tsx
│   │   │   │   ├── HeatmapChart.tsx
│   │   │   │   └── SentimentChart.tsx
│   │   │   ├── ui/              # 基础UI组件
│   │   │   ├── layout/          # 布局组件
│   │   │   └── stock/           # 股票相关组件
│   │   ├── lib/                 # 工具函数
│   │   ├── store/               # Zustand状态管理
│   │   ├── types/               # TypeScript类型
│   │   └── hooks/               # 自定义Hook
│   ├── package.json
│   └── tailwind.config.ts
│
├── backend/                     # NestJS后端
│   ├── src/
│   │   ├── modules/
│   │   │   ├── stock/           # 股票模块
│   │   │   ├── news/            # 新闻模块
│   │   │   ├── institution/     # 机构模块
│   │   │   ├── report/          # 报告生成
│   │   │   ├── ai/              # AI分析
│   │   │   ├── heatmap/         # 热力图
│   │   │   └── websocket/       # 实时数据
│   │   ├── common/              # 公共模块
│   │   │   ├── interceptors/
│   │   │   ├── filters/
│   │   │   └── guards/
│   │   └── database/            # 数据库配置
│   └── package.json
│
├── crawler/                     # Python爬虫
│   ├── spiders/
│   │   ├── stock/               # 股票数据爬虫
│   │   ├── news/                # 新闻爬虫
│   │   ├── institution/         # 机构数据（SEC 13F）
│   │   └── community/           # 社区数据
│   ├── scheduler/               # 任务调度
│   ├── utils/                   # 工具（代理/UA）
│   └── models/                  # 数据模型
│
├── docker/                      # 部署配置
│   ├── docker-compose.yml
│   └── nginx.conf
│
└── README.md
```

## 三、技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Next.js 14 + TypeScript | App Router |
| 样式 | TailwindCSS | 原子化CSS |
| 状态 | Zustand | 轻量状态管理 |
| K线 | lightweight-charts | TradingView |
| 图表 | ECharts | 热力图/饼图 |
| 后端 | NestJS + TypeScript | 模块化框架 |
| 数据库 | PostgreSQL + Redis | 主库+缓存 |
| 爬虫 | Python aiohttp+Playwright | 高并发+动态 |
| AI | OpenAI/Claude/Gemini | 多模型 |
| 部署 | Docker + Nginx | 容器化 |
