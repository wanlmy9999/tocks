# 📊 股票分析平台 — 生产级部署文档

> 完整金融数据分析平台：爬虫系统 + AI分析 + 机构追踪 + 热力图 + 报告生成

---

## 🏗️ 系统架构

```
用户浏览器
    │
    ▼
Next.js 前端 (3000)          ← 搜索/K线/热力图/机构/报告
    │
    ▼
NestJS 后端 API (4000)        ← REST + WebSocket
    │
    ├── PostgreSQL (5432)     ← 主数据库
    ├── Redis (6379)          ← 缓存 + 队列
    └── Python 爬虫 (8000)   ← 数据采集核心
             │
             ├── Yahoo Finance (80%)
             ├── 东方财富 / 新浪财经
             ├── SEC EDGAR 13F
             └── Reddit / 社区
```

---

## ⚡ 快速启动（Docker Compose）

### 第一步：克隆并配置环境变量

```bash
git clone <repo-url>
cd stock-platform
cp backend/.env.example backend/.env
```

编辑 `backend/.env`，填入你的 API Key（至少填一个 AI 接口）：
```env
OPENAI_API_KEY=sk-xxxxxxxxxxxx   # 或 ANTHROPIC_API_KEY / GEMINI_API_KEY
```

### 第二步：启动全部服务

```bash
docker-compose up -d --build
```

等待约 2 分钟（首次构建），然后访问：

| 服务 | 地址 |
|------|------|
| 🖥️  前端 | http://localhost:3000 |
| 📡 API 文档 | http://localhost:4000/api/docs |
| 🕷️  爬虫服务 | http://localhost:8000/docs |

### 第三步：验证

```bash
# 检查所有容器状态
docker-compose ps

# 测试 API
curl http://localhost:4000/api/v1/stocks/search?q=NVDA

# 测试爬虫
curl http://localhost:8000/quote/NVDA

# 查看日志
docker-compose logs -f backend
docker-compose logs -f scraper
```

---

## 🛠️ 本地开发（无 Docker）

### 前置依赖

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥ 20 | 前端 + 后端 |
| Python | ≥ 3.11 | 爬虫服务 |
| PostgreSQL | ≥ 15 | 主数据库 |
| Redis | ≥ 7 | 缓存 |

### 1. 数据库初始化

```bash
# 创建数据库
psql -U postgres -c "CREATE DATABASE stock_platform;"

# 执行 Schema
psql -U postgres -d stock_platform -f backend/src/database/schema.sql

# 验证
psql -U postgres -d stock_platform -c "\dt"
```

### 2. 后端启动

```bash
cd backend
cp .env.example .env          # 编辑填入你的配置
npm install
npm run start:dev             # 开发模式（热重载）
# → http://localhost:4000
```

### 3. 爬虫服务启动

```bash
cd scrapers
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium    # 安装浏览器（Playwright）

# 配置环境变量
cp .env.example .env

uvicorn main:app --reload --port 8000
# → http://localhost:8000
```

### 4. 前端启动

```bash
cd frontend
npm install
# 创建 .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1" > .env.local
echo "NEXT_PUBLIC_WS_URL=http://localhost:4000" >> .env.local

npm run dev
# → http://localhost:3000
```

---

## 📁 完整项目结构

```
stock-platform/
├── frontend/                    # Next.js 14 前端
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # 首页（市场总览）
│   │   │   ├── search/page.tsx       # 股票搜索
│   │   │   ├── stocks/[symbol]/      # 股票详情
│   │   │   ├── heatmap/page.tsx      # 热力图
│   │   │   ├── institutions/         # 机构追踪列表
│   │   │   ├── institutions/[id]/    # 机构详情
│   │   │   └── reports/page.tsx      # 报告生成
│   │   ├── components/
│   │   │   ├── charts/KlineChart.tsx       # K线图
│   │   │   ├── charts/SentimentGauge.tsx   # 情绪仪表盘
│   │   │   ├── charts/FinancialsChart.tsx  # 财务图表
│   │   │   ├── layout/Sidebar.tsx          # 侧边导航
│   │   │   └── layout/Navbar.tsx           # 顶部导航
│   │   ├── lib/api.ts            # API 接口封装
│   │   ├── lib/format.ts         # 数字/日期格式化
│   │   └── store/stockStore.ts   # Zustand 状态管理
│   ├── package.json
│   ├── tailwind.config.js
│   └── Dockerfile
│
├── backend/                     # NestJS 后端
│   ├── src/
│   │   ├── modules/
│   │   │   ├── stocks/           # 股票模块
│   │   │   ├── news/             # 新闻模块
│   │   │   ├── institutions/     # 机构追踪模块
│   │   │   ├── sentiment/        # 情绪分析模块
│   │   │   ├── reports/          # 报告生成模块
│   │   │   ├── heatmap/          # 热力图模块
│   │   │   ├── websocket/        # WebSocket 实时推送
│   │   │   └── ai/               # AI 分析模块
│   │   ├── common/               # 通用过滤器/拦截器
│   │   └── database/schema.sql   # 完整 DB Schema
│   ├── package.json
│   └── Dockerfile
│
├── scrapers/                    # Python 爬虫服务
│   ├── main.py                  # FastAPI 入口
│   ├── spiders/
│   │   ├── stocks/yahoo_spider.py      # Yahoo Finance 爬虫
│   │   ├── stocks/eastmoney_spider.py  # 东方财富爬虫
│   │   ├── news/news_spider.py         # 多源新闻爬虫
│   │   ├── institutions/sec_spider.py  # SEC 13F 爬虫
│   │   └── community/reddit_spider.py  # Reddit 社区爬虫
│   ├── utils/
│   │   ├── helpers.py           # 工具函数
│   │   ├── database.py          # 数据库连接
│   │   └── logger.py            # 日志配置
│   ├── scheduler/               # 定时任务调度
│   ├── requirements.txt
│   └── Dockerfile
│
├── ai-service/                  # AI 分析服务
│   └── providers/ai_providers.py  # 多模型支持
│
├── docker-compose.yml           # 一键启动
└── README.md
```

---

## 🔌 核心 API 接口

### 股票接口

```bash
# 搜索（支持中/英文/代码）
GET /api/v1/stocks/search?q=英伟达

# 股票详情
GET /api/v1/stocks/NVDA

# K线数据
GET /api/v1/stocks/NVDA/klines?period=1d&limit=300

# 实时行情
GET /api/v1/stocks/NVDA/quote

# 财务数据
GET /api/v1/stocks/NVDA/financials?type=annual
```

### 机构追踪

```bash
# 热门机构（首页）
GET /api/v1/institutions/top?limit=6

# 机构排行榜
GET /api/v1/institutions/ranking?page=1&pageSize=20

# 机构详情
GET /api/v1/institutions/{id}

# 机构持仓（分页+搜索+排序）
GET /api/v1/institutions/{id}/holdings?page=1&search=AAPL&sortBy=market_value
```

### 热力图

```bash
GET /api/v1/heatmap?market=us&sector=Technology
GET /api/v1/heatmap/sectors
```

### 报告生成

```bash
# 生成报告（异步）
POST /api/v1/reports/generate
{ "symbol": "NVDA", "format": "pptx" }

# 查询状态
GET /api/v1/reports/{id}/status

# 下载
GET /api/v1/reports/{id}/download
```

### WebSocket 实时推送

```javascript
const socket = io('http://localhost:4000/realtime');
socket.emit('subscribe', { symbol: 'NVDA' });
socket.on('quote', (data) => console.log(data));
// { symbol, price, change, changePct, volume, timestamp }
```

---

## 🤖 AI 配置

支持 4 种 AI 提供商，在 `.env` 中配置 `AI_PROVIDER`：

```env
AI_PROVIDER=openai    # openai | claude | gemini | ollama
```

| 提供商 | 环境变量 | 推荐模型 |
|--------|---------|---------|
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Claude | `ANTHROPIC_API_KEY` | `claude-3-haiku-20240307` |
| Gemini | `GEMINI_API_KEY` | `gemini-1.5-flash` |
| Ollama | `OLLAMA_BASE_URL` | `llama3.1:8b`（本地免费） |

---

## 🧪 测试

```bash
# 后端单元测试
cd backend && npm test

# API 集成测试
curl -X POST http://localhost:4000/api/v1/reports/generate \
  -H "Content-Type: application/json" \
  -d '{"symbol":"NVDA","format":"pptx"}'

# 爬虫测试
cd scrapers
python -m pytest tests/ -v

# 前端类型检查
cd frontend && npm run lint
```

---

## 📈 性能优化

| 指标 | 目标 | 实现方式 |
|------|------|---------|
| 首页加载 | < 2s | Redis 缓存 + 静态优化 |
| 图表响应 | < 200ms | 预聚合 + 分层缓存 |
| 数据延迟 | < 5s | WebSocket + 定时刷新 |
| 爬虫并发 | 20 req/s | aiohttp + 连接池 |

---

## 🔄 数据更新策略

| 数据类型 | 更新频率 | 方式 |
|---------|---------|------|
| 实时行情 | 5 秒 | WebSocket |
| K线（日线） | 1 分钟 | 定时任务 |
| 新闻 | 10 分钟 | Bull 队列 |
| 机构持仓 | 每季度 | SEC 13F 爬虫 |
| 财务数据 | 每月 | Yahoo Finance |

---

## 🚀 生产部署（Nginx 反向代理）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }

    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_set_header Host $host;
    }

    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 🛡️ 免责声明

> 本平台数据仅供学习研究使用，不构成投资建议。
> 爬虫数据遵循 robots.txt 规范，请合理使用。
