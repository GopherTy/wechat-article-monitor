import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;
let _initialized = false;

/**
 * 从 DATABASE_URL 中解析数据库名
 */
function parseDatabaseName(url: string): { baseUrl: string; dbName: string } | null {
  try {
    const parsed = new URL(url);
    const dbName = parsed.pathname.replace(/^\//, '');
    if (!dbName) return null;
    parsed.pathname = '/postgres'; // 连接默认的 postgres 库
    return { baseUrl: parsed.toString(), dbName };
  } catch {
    return null;
  }
}

/**
 * 确保目标数据库存在，不存在则自动创建
 */
async function ensureDatabaseExists(databaseUrl: string): Promise<void> {
  const parsed = parseDatabaseName(databaseUrl);
  if (!parsed) return;

  const { baseUrl, dbName } = parsed;

  // 连接默认 postgres 库来检查/创建目标数据库
  const adminClient = postgres(baseUrl, {
    max: 1,
    connect_timeout: 10,
  });

  try {
    const result = await adminClient`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;

    if (result.length === 0) {
      // 数据库不存在，创建它
      // 注意: CREATE DATABASE 不能在事务中运行，postgres.js 默认不在事务中
      await adminClient.unsafe(`CREATE DATABASE "${dbName}"`);
      console.info(`[DB] 数据库 "${dbName}" 已自动创建`);
    }
  } catch (err: any) {
    // 如果是"数据库已存在"错误(42P04)，忽略
    if (err.code !== '42P04') {
      console.error(`[DB] 检查/创建数据库失败:`, err.message);
    }
  } finally {
    await adminClient.end();
  }
}

/**
 * 获取 PostgreSQL 数据库连接
 * 使用单例模式，避免重复创建连接池
 * 首次连接时自动检查并创建数据库
 */
export function getDb() {
  if (!_db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL 环境变量未配置');
    }

    _client = postgres(databaseUrl, {
      max: 10, // 连接池最大连接数
      idle_timeout: 20, // 空闲连接超时（秒）
      connect_timeout: 10, // 连接超时（秒）
    });

    _db = drizzle(_client, { schema });
  }
  return _db;
}

/**
 * 初始化数据库（确保库存在 + 建表）
 * 应在首次使用前调用一次
 */
export async function initializeDb(): Promise<void> {
  if (_initialized) return;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL 环境变量未配置');
  }

  // 1. 确保数据库存在
  await ensureDatabaseExists(databaseUrl);

  // 2. 获取连接
  const db = getDb();

  // 3. 创建所有表（幂等）
  await db.execute(/* sql */ `
    CREATE TABLE IF NOT EXISTS mp_account (
      fakeid VARCHAR(64) PRIMARY KEY,
      nickname VARCHAR(255),
      round_head_img TEXT,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      count INTEGER NOT NULL DEFAULT 0,
      articles INTEGER NOT NULL DEFAULT 0,
      total_count INTEGER NOT NULL DEFAULT 0,
      create_time INTEGER,
      update_time INTEGER,
      last_update_time INTEGER
    );

    CREATE TABLE IF NOT EXISTS article (
      id VARCHAR(255) PRIMARY KEY,
      fakeid VARCHAR(64) NOT NULL,
      aid VARCHAR(64) NOT NULL,
      title TEXT,
      link TEXT,
      digest TEXT,
      cover TEXT,
      author_name VARCHAR(255),
      create_time INTEGER,
      update_time INTEGER,
      appmsgid BIGINT,
      itemidx INTEGER,
      is_deleted BOOLEAN DEFAULT FALSE,
      _status VARCHAR(64) DEFAULT '',
      _single BOOLEAN DEFAULT FALSE,
      extra JSONB DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_article_fakeid ON article(fakeid);
    CREATE INDEX IF NOT EXISTS idx_article_create_time ON article(create_time);
    CREATE INDEX IF NOT EXISTS idx_article_link ON article(link);

    CREATE TABLE IF NOT EXISTS html_content (
      url TEXT PRIMARY KEY,
      fakeid VARCHAR(64) NOT NULL,
      title TEXT,
      comment_id VARCHAR(255),
      file_data BYTEA NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_html_fakeid ON html_content(fakeid);

    CREATE TABLE IF NOT EXISTS comment (
      url TEXT PRIMARY KEY,
      fakeid VARCHAR(64) NOT NULL,
      title TEXT,
      data JSONB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_comment_fakeid ON comment(fakeid);

    CREATE TABLE IF NOT EXISTS comment_reply (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      fakeid VARCHAR(64) NOT NULL,
      title TEXT,
      content_id VARCHAR(255) NOT NULL,
      data JSONB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_comment_reply_url ON comment_reply(url);
    CREATE INDEX IF NOT EXISTS idx_comment_reply_fakeid ON comment_reply(fakeid);

    CREATE TABLE IF NOT EXISTS metadata (
      url TEXT PRIMARY KEY,
      fakeid VARCHAR(64) NOT NULL,
      title TEXT,
      read_num INTEGER DEFAULT 0,
      old_like_num INTEGER DEFAULT 0,
      share_num INTEGER DEFAULT 0,
      like_num INTEGER DEFAULT 0,
      comment_num INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_metadata_fakeid ON metadata(fakeid);

    CREATE TABLE IF NOT EXISTS resource (
      url TEXT PRIMARY KEY,
      fakeid VARCHAR(64) NOT NULL,
      file_data BYTEA NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_resource_fakeid ON resource(fakeid);

    CREATE TABLE IF NOT EXISTS resource_map (
      url TEXT PRIMARY KEY,
      fakeid VARCHAR(64) NOT NULL,
      resources TEXT[] NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_resource_map_fakeid ON resource_map(fakeid);

    CREATE TABLE IF NOT EXISTS asset (
      url TEXT PRIMARY KEY,
      fakeid VARCHAR(64) NOT NULL,
      file_data BYTEA NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_asset_fakeid ON asset(fakeid);

    CREATE TABLE IF NOT EXISTS debug (
      url TEXT PRIMARY KEY,
      fakeid VARCHAR(64) NOT NULL,
      type VARCHAR(64),
      title TEXT,
      file_data BYTEA NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_debug_fakeid ON debug(fakeid);

    CREATE TABLE IF NOT EXISTS watched_account (
      fakeid VARCHAR(64) PRIMARY KEY,
      nickname VARCHAR(255),
      round_head_img TEXT,
      enabled BOOLEAN DEFAULT TRUE,
      last_check_time INTEGER DEFAULT 0,
      last_known_aid VARCHAR(64) DEFAULT '',
      check_count INTEGER DEFAULT 0,
      last_discovery_at INTEGER DEFAULT 0,
      discovered_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS comment_monitor_task (
      id SERIAL PRIMARY KEY,
      fakeid VARCHAR(64) NOT NULL,
      nickname VARCHAR(255),
      article_url TEXT,
      article_title TEXT,
      article_aid VARCHAR(64),
      comment_id VARCHAR(255) DEFAULT '',
      status VARCHAR(32) NOT NULL,
      created_at INTEGER NOT NULL,
      tracking_end_at INTEGER DEFAULT 0,
      accumulated_comments JSONB DEFAULT '[]',
      final_comments JSONB DEFAULT '[]',
      shielded_comments JSONB DEFAULT '[]',
      stats JSONB DEFAULT '{}',
      error_msg TEXT DEFAULT '',
      auto_track_enabled BOOLEAN DEFAULT TRUE,
      source VARCHAR(16) DEFAULT 'auto',
      source_fakeid VARCHAR(64),
      last_sync_at INTEGER DEFAULT 0,
      comment_first_seen_at JSONB DEFAULT '{}',
      comment_shielded_at JSONB DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_cmt_fakeid ON comment_monitor_task(fakeid);
    CREATE INDEX IF NOT EXISTS idx_cmt_status ON comment_monitor_task(status);
    CREATE INDEX IF NOT EXISTS idx_cmt_created ON comment_monitor_task(created_at);

    -- 兼容旧表：升级字段类型
    ALTER TABLE article ALTER COLUMN appmsgid TYPE BIGINT;
    ALTER TABLE article ALTER COLUMN title TYPE TEXT;
    ALTER TABLE html_content ALTER COLUMN title TYPE TEXT;
    ALTER TABLE comment ALTER COLUMN title TYPE TEXT;
    ALTER TABLE comment_reply ALTER COLUMN title TYPE TEXT;
    ALTER TABLE metadata ALTER COLUMN title TYPE TEXT;
    ALTER TABLE debug ALTER COLUMN title TYPE TEXT;
    ALTER TABLE comment_monitor_task ALTER COLUMN article_title TYPE TEXT;
  `);

  _initialized = true;
  console.info('[DB] 数据库初始化完成');
}

/**
 * 关闭数据库连接（用于优雅关闭）
 */
export async function closeDb() {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
    _initialized = false;
  }
}
