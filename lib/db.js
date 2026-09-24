import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

const connectionString = process.env.DATABASE_URL?.replace('file://./', '')?.replace('file:./', '') || './dev.db';
const db = new Database(connectionString);

// Initialize tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS User (
    id TEXT PRIMARY KEY,
    username VARCHAR UNIQUE NOT NULL,
    password TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export default db;
export { randomUUID as uuid };
