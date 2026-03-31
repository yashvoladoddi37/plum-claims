import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'claims.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

// Initialize tables on first import
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    join_date TEXT NOT NULL,
    policy_start_date TEXT NOT NULL,
    policy_id TEXT DEFAULT 'PLUM_OPD_2024'
  );

  CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PROCESSING',
    claim_amount REAL NOT NULL,
    approved_amount REAL,
    treatment_date TEXT NOT NULL,
    submission_date TEXT NOT NULL,
    hospital TEXT,
    cashless_request INTEGER DEFAULT 0,
    input_data_json TEXT,
    documents_json TEXT,
    extraction_json TEXT,
    decision TEXT,
    decision_reasons_json TEXT,
    decision_notes TEXT,
    confidence_score REAL,
    processing_time_ms INTEGER,
    pipeline_result_json TEXT,
    appeal_status TEXT,
    appeal_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
