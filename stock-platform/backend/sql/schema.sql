-- ================================================================
-- 股票分析平台 数据库建表SQL
-- PostgreSQL 15+
-- ================================================================

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 股票基础信息表
-- ================================================================
CREATE TABLE IF NOT EXISTS stocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL UNIQUE,        -- 股票代码 (NVDA)
    name_en VARCHAR(200) NOT NULL,              -- 英文名称
    name_zh VARCHAR(200),                       -- 中文名称
    exchange VARCHAR(20),                       -- 交易所 (NASDAQ/NYSE)
    sector VARCHAR(100),                        -- 行业板块
    industry VARCHAR(200),                      -- 细分行业
    market_cap BIGINT,                          -- 市值（美元）
    description TEXT,                           -- 公司简介
    logo_url VARCHAR(500),                      -- Logo URL
    website VARCHAR(300),                       -- 官网
    country VARCHAR(50) DEFAULT 'US',           -- 国家
    currency VARCHAR(10) DEFAULT 'USD',         -- 货币
    ipo_date DATE,                              -- 上市日期
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 股票搜索索引
CREATE INDEX idx_stocks_symbol ON stocks(symbol);
CREATE INDEX idx_stocks_name_zh ON stocks(name_zh);
CREATE INDEX idx_stocks_name_en ON stocks(name_en);
CREATE INDEX idx_stocks_sector ON stocks(sector);

-- ================================================================
-- 实时行情表
-- ================================================================
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL REFERENCES stocks(symbol),
    price DECIMAL(18, 4) NOT NULL,              -- 当前价
    open DECIMAL(18, 4),                        -- 开盘价
    high DECIMAL(18, 4),                        -- 最高价
    low DECIMAL(18, 4),                         -- 最低价
    prev_close DECIMAL(18, 4),                  -- 昨收
    change DECIMAL(18, 4),                      -- 涨跌额
    change_percent DECIMAL(10, 4),              -- 涨跌幅%
    volume BIGINT,                              -- 成交量
    avg_volume BIGINT,                          -- 平均成交量
    market_cap BIGINT,                          -- 实时市值
    pe_ratio DECIMAL(12, 4),                    -- 市盈率
    eps DECIMAL(12, 4),                         -- 每股收益
    week_52_high DECIMAL(18, 4),               -- 52周最高
    week_52_low DECIMAL(18, 4),                -- 52周最低
    dividend_yield DECIMAL(8, 4),               -- 股息收益率
    beta DECIMAL(8, 4),                         -- Beta系数
    timestamp TIMESTAMP DEFAULT NOW(),
    source VARCHAR(50)                          -- 数据来源
);

CREATE INDEX idx_quotes_symbol ON quotes(symbol);
CREATE INDEX idx_quotes_timestamp ON quotes(timestamp DESC);

-- ================================================================
-- K线数据表
-- ================================================================
CREATE TABLE IF NOT EXISTS kline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL REFERENCES stocks(symbol),
    period VARCHAR(10) NOT NULL,                -- 周期: 1d/1w/1m/1y
    open_time TIMESTAMP NOT NULL,
    open DECIMAL(18, 4) NOT NULL,
    high DECIMAL(18, 4) NOT NULL,
    low DECIMAL(18, 4) NOT NULL,
    close DECIMAL(18, 4) NOT NULL,
    volume BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(symbol, period, open_time)
);

CREATE INDEX idx_kline_symbol_period ON kline(symbol, period, open_time DESC);

-- ================================================================
-- 新闻表
-- ================================================================
CREATE TABLE IF NOT EXISTS news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20),                         -- 关联股票（可为空）
    title VARCHAR(500) NOT NULL,
    content TEXT,
    summary TEXT,                               -- AI生成摘要
    url VARCHAR(1000),
    source VARCHAR(100),                        -- 来源
    author VARCHAR(200),
    image_url VARCHAR(500),
    published_at TIMESTAMP,
    sentiment DECIMAL(5, 4),                   -- 情绪分 -1 ~ 1
    sentiment_label VARCHAR(20),               -- positive/neutral/negative
    tags TEXT[],                               -- 标签
    hash VARCHAR(64) UNIQUE,                   -- 去重hash
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_news_symbol ON news(symbol);
CREATE INDEX idx_news_published_at ON news(published_at DESC);
CREATE INDEX idx_news_sentiment ON news(sentiment_label);

-- ================================================================
-- 社区评论表
-- ================================================================
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20),
    platform VARCHAR(50),                      -- reddit/eastmoney/xueqiu
    external_id VARCHAR(200),                  -- 平台原始ID
    author VARCHAR(200),
    content TEXT NOT NULL,
    upvotes INT DEFAULT 0,
    url VARCHAR(1000),
    sentiment DECIMAL(5, 4),
    sentiment_label VARCHAR(20),
    published_at TIMESTAMP,
    hash VARCHAR(64) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_comments_symbol ON comments(symbol);
CREATE INDEX idx_comments_platform ON comments(platform);

-- ================================================================
-- 机构信息表
-- ================================================================
CREATE TABLE IF NOT EXISTS institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cik VARCHAR(20) UNIQUE,                    -- SEC CIK编号
    name VARCHAR(300) NOT NULL,
    name_zh VARCHAR(300),                      -- 中文名
    type VARCHAR(100),                         -- 机构类型
    aum BIGINT,                                -- 管理资产规模（美元）
    holdings_count INT DEFAULT 0,             -- 持仓数量
    top_holding VARCHAR(20),                   -- 最大持仓股票
    description TEXT,
    logo_url VARCHAR(500),
    website VARCHAR(300),
    country VARCHAR(50) DEFAULT 'US',
    report_date DATE,                          -- 最新报告日期
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_institutions_cik ON institutions(cik);
CREATE INDEX idx_institutions_aum ON institutions(aum DESC);

-- ================================================================
-- 机构持仓表
-- ================================================================
CREATE TABLE IF NOT EXISTS holdings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id),
    symbol VARCHAR(20) NOT NULL,
    name_of_issuer VARCHAR(300),
    shares BIGINT NOT NULL,                    -- 持股数量
    value BIGINT NOT NULL,                     -- 市值（千美元）
    class_of_security VARCHAR(100),
    weight DECIMAL(8, 4),                      -- 持仓占比%
    sector VARCHAR(100),
    report_date DATE NOT NULL,
    prev_shares BIGINT,                        -- 上期持股
    change_shares BIGINT,                      -- 变化量
    change_percent DECIMAL(10, 4),             -- 变化%
    action VARCHAR(20),                        -- buy/sell/hold/new
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_holdings_institution ON holdings(institution_id);
CREATE INDEX idx_holdings_symbol ON holdings(symbol);
CREATE INDEX idx_holdings_report_date ON holdings(report_date DESC);
CREATE UNIQUE INDEX idx_holdings_unique ON holdings(institution_id, symbol, report_date);

-- ================================================================
-- 情绪分析表
-- ================================================================
CREATE TABLE IF NOT EXISTS sentiment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    positive_count INT DEFAULT 0,
    neutral_count INT DEFAULT 0,
    negative_count INT DEFAULT 0,
    positive_percent DECIMAL(8, 4),
    neutral_percent DECIMAL(8, 4),
    negative_percent DECIMAL(8, 4),
    avg_score DECIMAL(8, 4),
    source VARCHAR(50),                        -- news/reddit/community
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(symbol, date, source)
);

CREATE INDEX idx_sentiment_symbol ON sentiment(symbol, date DESC);

-- ================================================================
-- 报告生成记录表
-- ================================================================
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    format VARCHAR(20) NOT NULL,               -- md/xlsx/pptx/pdf
    file_path VARCHAR(500),
    file_size INT,
    status VARCHAR(20) DEFAULT 'pending',      -- pending/processing/done/error
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- ================================================================
-- 爬虫任务记录表
-- ================================================================
CREATE TABLE IF NOT EXISTS crawler_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_type VARCHAR(100) NOT NULL,
    target VARCHAR(200),
    status VARCHAR(20) DEFAULT 'pending',
    result JSONB,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ================================================================
-- 初始化热门股票数据
-- ================================================================
INSERT INTO stocks (symbol, name_en, name_zh, exchange, sector, industry) VALUES
('AAPL', 'Apple Inc.', '苹果公司', 'NASDAQ', 'Technology', 'Consumer Electronics'),
('MSFT', 'Microsoft Corporation', '微软公司', 'NASDAQ', 'Technology', 'Software'),
('NVDA', 'NVIDIA Corporation', '英伟达', 'NASDAQ', 'Technology', 'Semiconductors'),
('GOOGL', 'Alphabet Inc.', '谷歌母公司', 'NASDAQ', 'Technology', 'Internet Services'),
('AMZN', 'Amazon.com Inc.', '亚马逊', 'NASDAQ', 'Consumer Cyclical', 'E-Commerce'),
('META', 'Meta Platforms Inc.', 'Meta公司', 'NASDAQ', 'Technology', 'Social Media'),
('TSLA', 'Tesla Inc.', '特斯拉', 'NASDAQ', 'Automotive', 'Electric Vehicles'),
('BRK.B', 'Berkshire Hathaway B', '伯克希尔B', 'NYSE', 'Financial Services', 'Insurance'),
('JPM', 'JPMorgan Chase & Co.', '摩根大通', 'NYSE', 'Financial Services', 'Banking'),
('JNJ', 'Johnson & Johnson', '强生公司', 'NYSE', 'Healthcare', 'Pharmaceuticals'),
('V', 'Visa Inc.', '维萨', 'NYSE', 'Financial Services', 'Payment Processing'),
('PG', 'Procter & Gamble Co.', '宝洁公司', 'NYSE', 'Consumer Defensive', 'Household Products'),
('UNH', 'UnitedHealth Group', '联合健康集团', 'NYSE', 'Healthcare', 'Health Insurance'),
('HD', 'Home Depot Inc.', '家得宝', 'NYSE', 'Consumer Cyclical', 'Home Improvement'),
('MA', 'Mastercard Inc.', '万事达卡', 'NYSE', 'Financial Services', 'Payment Processing'),
('BABA', 'Alibaba Group', '阿里巴巴', 'NYSE', 'Technology', 'E-Commerce'),
('TSM', 'Taiwan Semiconductor', '台积电', 'NYSE', 'Technology', 'Semiconductors'),
('AMD', 'Advanced Micro Devices', 'AMD', 'NASDAQ', 'Technology', 'Semiconductors'),
('INTC', 'Intel Corporation', '英特尔', 'NASDAQ', 'Technology', 'Semiconductors'),
('NFLX', 'Netflix Inc.', '奈飞', 'NASDAQ', 'Communication Services', 'Streaming')
ON CONFLICT (symbol) DO NOTHING;

-- 初始化热门机构数据
INSERT INTO institutions (cik, name, name_zh, type, aum, holdings_count) VALUES
('0001067983', 'Berkshire Hathaway', '伯克希尔哈撒韦', 'Hedge Fund', 300000000000, 45),
('0000102909', 'Vanguard Group', '先锋集团', 'Mutual Fund', 7500000000000, 4000),
('0001364742', 'BlackRock', '贝莱德', 'Asset Manager', 9500000000000, 5000),
('0000884445', 'State Street Corp', '道富集团', 'Asset Manager', 3800000000000, 3500),
('0001037389', 'Fidelity Investments', '富达投资', 'Mutual Fund', 4500000000000, 3000),
('0001350694', 'Renaissance Technologies', '文艺复兴科技', 'Hedge Fund', 130000000000, 2000)
ON CONFLICT (cik) DO NOTHING;

COMMENT ON TABLE stocks IS '股票基础信息';
COMMENT ON TABLE quotes IS '实时行情数据';
COMMENT ON TABLE kline IS 'K线历史数据';
COMMENT ON TABLE news IS '新闻资讯';
COMMENT ON TABLE comments IS '社区评论';
COMMENT ON TABLE institutions IS '机构信息';
COMMENT ON TABLE holdings IS '机构持仓';
COMMENT ON TABLE sentiment IS '情绪分析';
COMMENT ON TABLE reports IS '报告生成记录';
