import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import fs from "node:fs";
import path from "node:path";
import { AppConfig } from "./config.js";

export type QueueStatus = "pending" | "processing" | "done" | "failed";

export interface QueueItem {
  id: number;
  entryId: string;
  title: string;
  content: string;
  summary?: string;
  status: QueueStatus;
  retries: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export class Db {
  private db!: SqlJsDatabase;
  private dbPath: string;
  private SQL!: any;

  constructor(config: AppConfig) {
    this.dbPath = config.dbPath;
  }

  async init() {
    this.SQL = await initSqlJs();
    this.ensureDir(this.dbPath);
    
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(buffer);
    } else {
      this.db = new this.SQL.Database();
    }
    
    this.createTables();
    this.resetStaleProcessing();
    this.save();
  }

  private ensureDir(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private createTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        retries INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_queue_status_created ON queue(status, created_at);`);
    this.db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_entry ON queue(entry_id);`);
  }

  private resetStaleProcessing() {
    this.db.run(
      "UPDATE queue SET status = 'pending', updated_at = datetime('now') WHERE status = 'processing'"
    );
  }

  private save() {
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, data);
  }

  insertQueueItem(entryId: string, title: string, content: string) {
    this.db.run(
      `INSERT OR IGNORE INTO queue(entry_id, title, content) VALUES (?, ?, ?);`,
      [entryId, title, content]
    );
    this.save();
  }

  getNextPending(): QueueItem | undefined {
    const result = this.db.exec(
      `SELECT * FROM queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1;`
    );

    if (!result.length || !result[0].values.length) return undefined;

    const row = this.rowToObject(result[0].columns, result[0].values[0]);
    
    this.db.run(
      "UPDATE queue SET status = 'processing', updated_at = datetime('now') WHERE id = ?",
      [row.id]
    );
    this.save();

    return this.mapRow(row, "processing");
  }

  deleteQueueItem(id: number) {
    this.db.run("DELETE FROM queue WHERE id = ?", [id]);
    this.save();
  }

  markFailed(id: number, error: string, shouldRetry: boolean) {
    const nextStatus: QueueStatus = shouldRetry ? "pending" : "failed";
    this.db.run(
      "UPDATE queue SET status = ?, retries = retries + 1, error = ?, updated_at = datetime('now') WHERE id = ?",
      [nextStatus, error, id]
    );
    this.save();
  }

  private rowToObject(columns: string[], values: any[]): any {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = values[idx];
    });
    return obj;
  }

  private mapRow(row: any, status: QueueStatus): QueueItem {
    return {
      id: row.id,
      entryId: row.entry_id,
      title: row.title,
      content: row.content,
      summary: row.summary ?? undefined,
      status,
      retries: row.retries,
      error: row.error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  close() {
    this.save();
    this.db.close();
  }
}
