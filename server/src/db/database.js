const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DB_DIR, 'qa-tool.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS test_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      requirement TEXT NOT NULL,
      url TEXT,
      image_path TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS test_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_run_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      feature TEXT NOT NULL,
      title TEXT NOT NULL,
      preconditions TEXT,
      steps TEXT NOT NULL,
      expected TEXT NOT NULL,
      priority TEXT DEFAULT 'Medium',
      type TEXT DEFAULT 'Functional',
      platform TEXT DEFAULT 'Web',
      status TEXT DEFAULT 'not_run',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      gemini_api_key TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bug_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      title TEXT NOT NULL,
      steps_to_reproduce TEXT NOT NULL,
      actual_result TEXT NOT NULL,
      expected_result TEXT NOT NULL,
      severity TEXT DEFAULT 'Medium',
      priority TEXT DEFAULT 'Medium',
      status TEXT DEFAULT 'Open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_test_runs_project_id ON test_runs(project_id);
    CREATE INDEX IF NOT EXISTS idx_test_cases_test_run_id ON test_cases(test_run_id);
    CREATE INDEX IF NOT EXISTS idx_test_cases_project_id ON test_cases(project_id);
    CREATE INDEX IF NOT EXISTS idx_bug_reports_project_id ON bug_reports(project_id);
    CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
    CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
    CREATE INDEX IF NOT EXISTS idx_test_cases_status ON test_cases(status);
  `);

  console.log('Database initialized successfully');
}

module.exports = { db, initializeDatabase };

