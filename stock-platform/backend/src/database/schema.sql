-- ============================================================
-- 股票分析平台 - 完整数据库Schema
-- PostgreSQL 15+
-- ============================================================

-- 启用扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- 模糊搜索支持

-- ============================================================
-- 1. 股票基础信息表
-- ============================================================
CREATE TABLE IF NOT EXISTS stocks (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol        VARCHAR(20) UNIQUE NOT NULL,           -- 股票代码 NVDA
    name_en       VARCHAR(200) NOT NULL,                  -- 英文名称
    name_zh       VARCHAR(200),                           -- 中文名称
    exchange      VARCHAR(20),                            -- NASDAQ / NYSE / SSE / HKEX
    currency      VARCHAR(10) DEFAULT 'USD',
    sector        VARCHAR(100),                           -- 行业板块
    industry      VARCHAR(100),                           -- 细分行业
    country       VARCHAR(50) DEFAULT 'US',
    website       VARCHAR(300),
    description   TEXT,
    employees     BIGINT,
    founded_year  INTEGER,
    logo_url      VARCHAR(500),
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 搜索索引
CREATE INDEX idx_stocks_symbol ON stocks(symbol);
CREATE INDEX idx_stocks_name_en_trgm ON stocks USING GIN(name_en gin_trgm_ops);
CREATE INDEX idx_stocks_name_zh_trgm ON stocks USING GIN(name_zh gin_trgm_ops);

-- ============================================================
-- 2. 实时行情表
-- ============================================================
CREATE TABLE IF NOT EXISTS quotes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol          VARCHAR(20) NOT NULL REFERENCES stocks(symbol) ON DELETE CASCADE,
    price           DECIMAL(18,4) NOT NULL,
    open            DECIMAL(18,4),
    high            DECIMAL(18,4),
    low             DECIMAL(18,4),
    prev_close      DECIMAL(18,4),
    change          DECIMAL(18,4),
    change_pct      DECIMAL(8,4),
    volume          BIGINT,
    market_cap      DECIMAL(20,2),
    pe_ratio        DECIMAL(10,2),
    eps             DECIMAL(10,4),
    week_52_high    DECIMAL(18,4),
    week_52_low     DECIMAL(18,4),
    avg_volume      BIGINT,
    beta            DECIMAL(6,4),
    dividend_yield  DECIMAL(6,4),
    source          VARCHAR(50) DEFAULT 'scraper',       -- 数据来源
    quoted_at       TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quotes_symbol ON quotes(symbol);
CREATE INDEX idx_quotes_symbol_time ON quotes(symbol, quoted_at DESC);

-- ============================================================
-- 3. K线数据表
-- ============================================================
CREATE TABLE IF NOT EXISTS klines (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol      VARCHAR(20) NOT NULL REFERENCES stocks(symbol) ON DELETE CASCADE,
    period      VARCHAR(10) NOT NULL,          -- 1d / 1w / 1m / 5m / 15m / 1h
    open_time   TIMESTAMPTZ NOT NULL,
    close_time  TIMESTAMPTZ NOT NULL,
    open        DECIMAL(18,4) NOT NULL,
    high        DECIMAL(18,4) NOT NULL,
    low         DECIMAL(18,4) NOT NULL,
    close       DECIMAL(18,4) NOT NULL,
    volume      BIGINT,
    turnover    DECIMAL(20,2),                -- 成交额
    num_trades  INTEGER,                       -- 成交笔数
    source      VARCHAR(50) DEFAULT 'scraper',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(symbol, period, open_time)
);

CREATE INDEX idx_klines_symbol_period ON klines(symbol, period);
CREATE INDEX idx_klines_symbol_period_time ON klines(symbol, period, open_time DESC);

-- ============================================================
-- 4. 新闻表
-- ============================================================
CREATE TABLE IF NOT EXISTS news (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol       VARCHAR(20) REFERENCES stocks(symbol) ON DELETE SET NULL,
    title        TEXT NOT NULL,
    content      TEXT,
    summary      TEXT,
    source       VARCHAR(100),                -- Reuters / Bloomberg / 新浪财经
    source_url   VARCHAR(1000),
    author       VARCHAR(200),
    language     VARCHAR(10) DEFAULT 'zh',    -- zh / en
    tags         TEXT[],
    image_url    VARCHAR(500),
    content_hash VARCHAR(64) UNIQUE,          -- 去重用
    sentiment    VARCHAR(20),                 -- positive / neutral / negative
    sentiment_score DECIMAL(5,4),            -- 0~1
    published_at TIMESTAMPTZ,
    crawled_at   TIMESTAMPTZ DEFAULT NOW(),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_news_symbol ON news(symbol);
CREATE INDEX idx_news_published ON news(published_at DESC);
CREATE INDEX idx_news_symbol_time ON news(symbol, published_at DESC);

-- ============================================================
-- 5. 社区评论表
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol          VARCHAR(20) REFERENCES stocks(symbol) ON DELETE SET NULL,
    platform        VARCHAR(50),              -- reddit / eastmoney / xueqiu
    platform_id     VARCHAR(200),             -- 平台原始ID
    username        VARCHAR(200),
    content         TEXT NOT NULL,
    upvotes         INTEGER DEFAULT 0,
    downvotes       INTEGER DEFAULT 0,
    replies_count   INTEGER DEFAULT 0,
    url             VARCHAR(1000),
    content_hash    VARCHAR(64) UNIQUE,
    sentiment       VARCHAR(20),
    sentiment_score DECIMAL(5,4),
    posted_at       TIMESTAMPTZ,
    crawled_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_symbol ON comments(symbol);
CREATE INDEX idx_comments_symbol_time ON comments(symbol, posted_at DESC);

-- ============================================================
-- 6. 情绪分析聚合表
-- ============================================================
CREATE TABLE IF NOT EXISTS sentiment_summary (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol          VARCHAR(20) NOT NULL REFERENCES stocks(symbol) ON DELETE CASCADE,
    date            DATE NOT NULL,
    positive_count  INTEGER DEFAULT 0,
    neutral_count   INTEGER DEFAULT 0,
    negative_count  INTEGER DEFAULT 0,
    total_count     INTEGER DEFAULT 0,
    positive_pct    DECIMAL(5,2),
    neutral_pct     DECIMAL(5,2),
    negative_pct    DECIMAL(5,2),
    avg_score       DECIMAL(5,4),
    data_source     VARCHAR(50),              -- news / community / mixed
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(symbol, date, data_source)
);

CREATE INDEX idx_sentiment_symbol_date ON sentiment_summary(symbol, date DESC);

-- ============================================================
-- 7. 机构信息表
-- ============================================================
CREATE TABLE IF NOT EXISTS institutions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cik             VARCHAR(20) UNIQUE,       -- SEC CIK编号
    name            VARCHAR(300) NOT NULL,
    name_zh         VARCHAR(300),
    type            VARCHAR(100),             -- 基金/对冲基金/共同基金
    country         VARCHAR(50),
    aum             DECIMAL(20,2),            -- 管理资产规模(USD)
    description     TEXT,
    website         VARCHAR(500),
    logo_url        VARCHAR(500),
    filing_date     DATE,                     -- 最新13F申报日期
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_institutions_cik ON institutions(cik);
CREATE INDEX idx_institutions_name ON institutions(name);

-- ============================================================
-- 8. 机构持仓表
-- ============================================================
CREATE TABLE IF NOT EXISTS holdings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    symbol          VARCHAR(20) NOT NULL,
    company_name    VARCHAR(300),
    shares          BIGINT NOT NULL,
    market_value    DECIMAL(20,2) NOT NULL,
    portfolio_pct   DECIMAL(8,4),             -- 占投资组合百分比
    sector          VARCHAR(100),
    industry        VARCHAR(100),
    filing_quarter  VARCHAR(10) NOT NULL,     -- 2024Q4
    filing_date     DATE,
    prev_shares     BIGINT,                   -- 上期持仓
    share_change    BIGINT,                   -- 变化量
    change_type     VARCHAR(20),             -- buy / sell / hold / new / closed
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_holdings_institution ON holdings(institution_id);
CREATE INDEX idx_holdings_symbol ON holdings(symbol);
CREATE INDEX idx_holdings_quarter ON holdings(filing_quarter);
CREATE INDEX idx_holdings_inst_quarter ON holdings(institution_id, filing_quarter);

-- ============================================================
-- 9. 财务数据表
-- ============================================================
CREATE TABLE IF NOT EXISTS financials (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol          VARCHAR(20) NOT NULL REFERENCES stocks(symbol) ON DELETE CASCADE,
    period_type     VARCHAR(10) NOT NULL,     -- annual / quarterly
    period          VARCHAR(10) NOT NULL,     -- 2024 / 2024Q3
    revenue         DECIMAL(20,2),
    gross_profit    DECIMAL(20,2),
    operating_income DECIMAL(20,2),
    net_income      DECIMAL(20,2),
    ebitda          DECIMAL(20,2),
    total_assets    DECIMAL(20,2),
    total_debt      DECIMAL(20,2),
    cash            DECIMAL(20,2),
    free_cash_flow  DECIMAL(20,2),
    eps             DECIMAL(10,4),
    book_value      DECIMAL(10,4),
    roe             DECIMAL(8,4),
    roa             DECIMAL(8,4),
    debt_to_equity  DECIMAL(8,4),
    current_ratio   DECIMAL(8,4),
    source          VARCHAR(50) DEFAULT 'scraper',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(symbol, period_type, period)
);

CREATE INDEX idx_financials_symbol ON financials(symbol);

-- ============================================================
-- 10. 报告生成记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol      VARCHAR(20),
    format      VARCHAR(20) NOT NULL,         -- md / xlsx / pptx / pdf
    status      VARCHAR(20) DEFAULT 'pending', -- pending / processing / done / failed
    file_path   VARCHAR(500),
    file_size   BIGINT,
    error_msg   TEXT,
    params      JSONB,                        -- 生成参数
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_reports_symbol ON reports(symbol);
CREATE INDEX idx_reports_status ON reports(status);

-- ============================================================
-- 11. 爬虫任务表
-- ============================================================
CREATE TABLE IF NOT EXISTS crawler_tasks (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_type   VARCHAR(100) NOT NULL,        -- stock_data / news / institutions
    symbol      VARCHAR(20),
    status      VARCHAR(20) DEFAULT 'pending',
    priority    INTEGER DEFAULT 5,
    params      JSONB,
    result      JSONB,
    error_msg   TEXT,
    attempts    INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at  TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crawler_tasks_status ON crawler_tasks(status, priority DESC);
CREATE INDEX idx_crawler_tasks_type ON crawler_tasks(task_type);

-- ============================================================
-- 视图：股票热力图数据
-- ============================================================
CREATE OR REPLACE VIEW v_heatmap_data AS
SELECT
    s.symbol,
    s.name_zh,
    s.name_en,
    s.sector,
    s.industry,
    q.price,
    q.change_pct,
    q.market_cap,
    q.volume,
    q.quoted_at
FROM stocks s
JOIN LATERAL (
    SELECT * FROM quotes
    WHERE symbol = s.symbol
    ORDER BY quoted_at DESC
    LIMIT 1
) q ON true
WHERE s.is_active = TRUE;

-- ============================================================
-- 视图：机构持仓汇总
-- ============================================================
CREATE OR REPLACE VIEW v_institution_summary AS
SELECT
    i.id,
    i.name,
    i.name_zh,
    i.cik,
    i.aum,
    i.filing_date,
    COUNT(h.id) AS holdings_count,
    SUM(h.market_value) AS total_holdings_value,
    MAX(h.filing_quarter) AS latest_quarter
FROM institutions i
LEFT JOIN holdings h ON h.institution_id = i.id
GROUP BY i.id;

-- ============================================================
-- 函数：搜索股票（支持中英文 + 代码）
-- ============================================================
CREATE OR REPLACE FUNCTION search_stocks(query TEXT, limit_n INTEGER DEFAULT 10)
RETURNS TABLE(
    symbol VARCHAR,
    name_en VARCHAR,
    name_zh VARCHAR,
    exchange VARCHAR,
    sector VARCHAR,
    price DECIMAL,
    change_pct DECIMAL,
    score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.symbol,
        s.name_en,
        s.name_zh,
        s.exchange,
        s.sector,
        q.price,
        q.change_pct,
        GREATEST(
            similarity(UPPER(s.symbol), UPPER(query)),
            similarity(s.name_en, query),
            COALESCE(similarity(s.name_zh, query), 0)
        ) AS score
    FROM stocks s
    LEFT JOIN LATERAL (
        SELECT price, change_pct FROM quotes
        WHERE symbol = s.symbol ORDER BY quoted_at DESC LIMIT 1
    ) q ON true
    WHERE
        s.symbol ILIKE '%' || query || '%'
        OR s.name_en ILIKE '%' || query || '%'
        OR s.name_zh ILIKE '%' || query || '%'
    ORDER BY score DESC, s.symbol
    LIMIT limit_n;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 初始化热门股票数据
-- ============================================================
INSERT INTO stocks (symbol, name_en, name_zh, exchange, sector, industry, country) VALUES
('NVDA', 'NVIDIA Corporation', '英伟达', 'NASDAQ', 'Technology', 'Semiconductors', 'US'),
('AAPL', 'Apple Inc.', '苹果公司', 'NASDAQ', 'Technology', 'Consumer Electronics', 'US'),
('TSLA', 'Tesla Inc.', '特斯拉', 'NASDAQ', 'Consumer Discretionary', 'Automobile Manufacturers', 'US'),
('MSFT', 'Microsoft Corporation', '微软', 'NASDAQ', 'Technology', 'Software', 'US'),
('AMZN', 'Amazon.com Inc.', '亚马逊', 'NASDAQ', 'Consumer Discretionary', 'E-Commerce', 'US'),
('META', 'Meta Platforms Inc.', 'Meta', 'NASDAQ', 'Communication Services', 'Social Media', 'US'),
('GOOGL', 'Alphabet Inc.', '谷歌', 'NASDAQ', 'Communication Services', 'Internet Services', 'US'),
('BRK-B', 'Berkshire Hathaway', '伯克希尔哈撒韦', 'NYSE', 'Financial', 'Insurance', 'US'),
('JPM', 'JPMorgan Chase & Co.', '摩根大通', 'NYSE', 'Financial', 'Banking', 'US'),
('TSM', 'Taiwan Semiconductor', '台积电', 'NYSE', 'Technology', 'Semiconductors', 'TW'),
('BABA', 'Alibaba Group', '阿里巴巴', 'NYSE', 'Consumer Discretionary', 'E-Commerce', 'CN'),
('JD', 'JD.com Inc.', '京东', 'NASDAQ', 'Consumer Discretionary', 'E-Commerce', 'CN')
ON CONFLICT (symbol) DO NOTHING;

-- 初始化热门机构数据
INSERT INTO institutions (cik, name, name_zh, type, country) VALUES
('0000102909', 'Berkshire Hathaway Inc', '伯克希尔·哈撒韦', 'Holding Company', 'US'),
('0001336528', 'Bridgewater Associates', '桥水基金', 'Hedge Fund', 'US'),
('0001037389', 'Vanguard Group Inc', '先锋基金', 'Mutual Fund', 'US'),
('0000315066', 'BlackRock Inc', '贝莱德', 'Asset Manager', 'US'),
('0001035049', 'Renaissance Technologies', '文艺复兴科技', 'Hedge Fund', 'US'),
('0001067983', 'Soros Fund Management', '索罗斯基金', 'Hedge Fund', 'US')
ON CONFLICT (cik) DO NOTHING;

COMMENT ON TABLE stocks IS '股票基础信息表';
COMMENT ON TABLE quotes IS '实时行情表';
COMMENT ON TABLE klines IS 'K线历史数据表';
COMMENT ON TABLE news IS '新闻资讯表';
COMMENT ON TABLE comments IS '社区评论表';
COMMENT ON TABLE sentiment_summary IS '情绪分析聚合表';
COMMENT ON TABLE institutions IS '机构信息表';
COMMENT ON TABLE holdings IS '机构持仓表';
COMMENT ON TABLE financials IS '财务数据表';
COMMENT ON TABLE reports IS '报告生成记录表';
