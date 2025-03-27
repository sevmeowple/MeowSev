import { Database } from "bun:sqlite";
import path from "path";

export class SQLiteManager {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(path.resolve(dbPath));
  }

  query(sql: string) {
    return this.db.query(sql);
  }

  prepare(sql: string) {
    return this.db.prepare(sql);
  }

  close() {
    this.db.close();
  }
}