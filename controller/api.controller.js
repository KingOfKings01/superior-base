import db, { uuid } from "../lib/db.js";

// Helper to sanitize table and column names to prevent SQL injection
const sanitize = (name) => name.replace(/[^a-zA-Z0-9_]/g, '');

const ensureTableExists = (tableName) => {
  const safeName = sanitize(tableName);
  db.exec(`
    CREATE TABLE IF NOT EXISTS "${safeName}" (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Try to create trigger for updatedAt, ignore if exists
  try {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS "update_${safeName}_updatedAt"
      AFTER UPDATE ON "${safeName}"
      FOR EACH ROW
      BEGIN
        UPDATE "${safeName}" SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);
  } catch (e) {
    // Trigger might already exist
  }
  
  return safeName;
};

const ensureColumnsExist = (safeTableName, payload) => {
  const existingColumns = db.prepare(`PRAGMA table_info("${safeTableName}")`).all().map(c => c.name);
  const payloadKeys = Object.keys(payload);
  
  payloadKeys.forEach(key => {
    if (key === 'id' || key === 'userId' || key === 'createdAt' || key === 'updatedAt') return;
    
    if (!existingColumns.includes(key)) {
      const safeKey = sanitize(key);
      if (safeKey) {
        db.exec(`ALTER TABLE "${safeTableName}" ADD COLUMN "${safeKey}" TEXT;`);
      }
    }
  });
};

export const createRecord = async (req, res) => {
  try {
    const tableName = sanitize(req.params.collection);
    if (!tableName) return res.status(400).json({ message: "Invalid collection name" });
    
    ensureTableExists(tableName);
    ensureColumnsExist(tableName, req.body);
    
    const recordId = uuid();
    const keys = Object.keys(req.body).map(k => sanitize(k)).filter(k => k);
    const values = keys.map(k => req.body[k]);
    
    // Add built-in fields
    keys.push('id', 'userId');
    values.push(recordId, req.user.id);
    
    const placeholders = keys.map(() => '?').join(', ');
    const columnsString = keys.map(k => `"${k}"`).join(', ');
    
    db.prepare(`INSERT INTO "${tableName}" (${columnsString}) VALUES (${placeholders})`).run(...values);
    
    const record = db.prepare(`SELECT * FROM "${tableName}" WHERE id = ? AND userId = ?`).get(recordId, req.user.id);
    
    return res.status(201).json(record);
  } catch (error) {
    console.error("Create record error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getRecords = async (req, res) => {
  try {
    const tableName = sanitize(req.params.collection);
    if (!tableName) return res.status(400).json({ message: "Invalid collection name" });
    
    // Check if table exists
    const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
    
    if (!tableExists) {
      return res.json([]);
    }

    // Build the query dynamically based on req.query
    const existingColumns = db.prepare(`PRAGMA table_info("${tableName}")`).all().map(c => c.name);
    
    let queryStr = `SELECT * FROM "${tableName}" WHERE userId = ?`;
    const params = [req.user.id];
    
    for (const [key, value] of Object.entries(req.query)) {
      if (existingColumns.includes(key) && key !== 'userId') {
        queryStr += ` AND "${key}" = ?`;
        params.push(value);
      }
    }
    
    const records = db.prepare(queryStr).all(...params);
    
    return res.json(records);
  } catch (error) {
    console.error("Get records error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getRecord = async (req, res) => {
  try {
    const tableName = sanitize(req.params.collection);
    if (!tableName) return res.status(400).json({ message: "Invalid collection name" });
    
    const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
    if (!tableExists) return res.status(404).json({ message: "Record not found" });
    
    const record = db.prepare(`SELECT * FROM "${tableName}" WHERE id = ? AND userId = ?`).get(req.params.id, req.user.id);
    
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }
    
    return res.json(record);
  } catch (error) {
    console.error("Get record error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateRecord = async (req, res) => {
  try {
    const tableName = sanitize(req.params.collection);
    if (!tableName) return res.status(400).json({ message: "Invalid collection name" });
    
    const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
    if (!tableExists) return res.status(404).json({ message: "Record not found" });
    
    const record = db.prepare(`SELECT * FROM "${tableName}" WHERE id = ? AND userId = ?`).get(req.params.id, req.user.id);
    
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }
    
    ensureColumnsExist(tableName, req.body);
    
    const keys = Object.keys(req.body).map(k => sanitize(k)).filter(k => k && k !== 'id' && k !== 'userId' && k !== 'createdAt' && k !== 'updatedAt');
    
    if (keys.length === 0) {
      return res.json(record);
    }
    
    const setString = keys.map(k => `"${k}" = ?`).join(', ');
    const values = keys.map(k => req.body[k]);
    values.push(record.id, req.user.id);
    
    db.prepare(`UPDATE "${tableName}" SET ${setString} WHERE id = ? AND userId = ?`).run(...values);
    
    const updated = db.prepare(`SELECT * FROM "${tableName}" WHERE id = ? AND userId = ?`).get(record.id, req.user.id);
    
    return res.json(updated);
  } catch (error) {
    console.error("Update record error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteRecord = async (req, res) => {
  try {
    const tableName = sanitize(req.params.collection);
    if (!tableName) return res.status(400).json({ message: "Invalid collection name" });
    
    const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
    if (!tableExists) return res.status(404).json({ message: "Record not found" });
    
    const result = db.prepare(`DELETE FROM "${tableName}" WHERE id = ? AND userId = ?`).run(req.params.id, req.user.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ message: "Record not found" });
    }
    
    return res.json({ message: "Record deleted" });
  } catch (error) {
    console.error("Delete record error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
