import db, { uuid } from "../lib/db.js";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

const getTables = () => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(t => t.name);
  return tables.filter(t => t !== 'Collection' && t !== 'Record' && t !== '_prisma_migrations' && t !== 'Admin'); 
};

const sanitize = (name) => name.replace(/[^a-zA-Z0-9_]/g, '');

export const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Username and password required" });
    
    if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    const token = jwt.sign({ username, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return res.json({ message: "Login successful", token, role: 'admin' });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getTablesList = (req, res) => {
  res.json(getTables());
};

export const createTable = (req, res) => {
  const table = sanitize(req.body.name);
  const columns = req.body.columns || [];
  
  if (!table) return res.status(400).json({ error: 'Invalid table name' });
  if (table.toLowerCase() === 'admin') return res.status(400).json({ error: 'Cannot recreate Admin table' });
  
  try {
    const isUserTable = table.toLowerCase() === 'user';
    
    if (isUserTable) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS "${table}" (
          id TEXT PRIMARY KEY,
          username VARCHAR UNIQUE NOT NULL,
          password TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      db.exec(`
        CREATE TABLE IF NOT EXISTS "${table}" (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    
    columns.forEach(colObj => {
      const safeCol = sanitize(colObj.name);
      const rawType = colObj.type || 'TEXT';
      
      if (safeCol) {
        try {
          if (rawType.startsWith('RELATION:')) {
            const targetTable = sanitize(rawType.split(':')[1]);
            db.exec(`ALTER TABLE "${table}" ADD COLUMN "${safeCol}" TEXT REFERENCES "${targetTable}"(id);`);
          } else {
            const safeType = sanitize(rawType);
            db.exec(`ALTER TABLE "${table}" ADD COLUMN "${safeCol}" ${safeType};`);
          }
        } catch (e) {
          console.error(`Failed to add column ${safeCol}:`, e.message);
        }
      }
    });

    res.json({ success: true, table });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const dropTable = (req, res) => {
  const table = sanitize(req.params.table);
  
  if (!table) return res.status(400).json({ error: 'Invalid table name' });
  if (table.toLowerCase() === 'admin') return res.status(400).json({ error: 'Cannot drop the Admin table' });
  
  const tables = getTables();
  if (!tables.includes(table)) return res.status(404).json({ error: 'Table not found' });
  
  try {
    db.exec(`DROP TABLE "${table}";`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const editSchema = (req, res) => {
  const table = sanitize(req.params.table);
  const columns = req.body.columns || [];
  
  if (!table) return res.status(400).json({ error: 'Invalid table name' });
  if (table.toLowerCase() === 'admin') return res.status(400).json({ error: 'Cannot alter the Admin table schema' });
  
  const tables = getTables();
  if (!tables.includes(table)) return res.status(404).json({ error: 'Table not found' });
  
  const newTableName = `_new_${table}`;
  
  try {
    db.exec('BEGIN TRANSACTION;');
    
    const isUserTable = table.toLowerCase() === 'user';
    
    if (isUserTable) {
      db.exec(`
        CREATE TABLE "${newTableName}" (
          id TEXT PRIMARY KEY,
          username VARCHAR UNIQUE NOT NULL,
          password TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      db.exec(`
        CREATE TABLE "${newTableName}" (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    
    const colNames = isUserTable ? ['id', 'username', 'password', 'createdAt', 'updatedAt'] : ['id', 'userId', 'createdAt', 'updatedAt'];

    columns.forEach(colObj => {
      const safeCol = sanitize(colObj.name);
      const rawType = colObj.type || 'TEXT';
      
      if (safeCol && !colNames.includes(safeCol)) {
        colNames.push(safeCol);
        if (rawType.startsWith('RELATION:')) {
          const targetTable = sanitize(rawType.split(':')[1]);
          db.exec(`ALTER TABLE "${newTableName}" ADD COLUMN "${safeCol}" TEXT REFERENCES "${targetTable}"(id);`);
        } else {
          const safeType = sanitize(rawType);
          db.exec(`ALTER TABLE "${newTableName}" ADD COLUMN "${safeCol}" ${safeType};`);
        }
      }
    });

    const existingCols = db.prepare(`PRAGMA table_info("${table}")`).all().map(c => c.name);
    const colsToCopy = colNames.filter(c => existingCols.includes(c));
    
    const colListStr = colsToCopy.map(c => `"${c}"`).join(', ');
    
    if (colsToCopy.length > 0) {
      db.exec(`INSERT INTO "${newTableName}" (${colListStr}) SELECT ${colListStr} FROM "${table}";`);
    }
    
    db.exec(`DROP TABLE "${table}";`);
    db.exec(`ALTER TABLE "${newTableName}" RENAME TO "${table}";`);
    
    db.exec('COMMIT;');
    res.json({ success: true });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
};

export const getTableData = (req, res) => {
  const table = sanitize(req.params.table);
  const tables = getTables();
  if (!tables.includes(table)) return res.status(400).json({ error: 'Invalid table' });

  const columns = db.prepare(`PRAGMA table_info("${table}")`).all();
  const fks = db.prepare(`PRAGMA foreign_key_list("${table}")`).all();
  
  const foreignKeys = fks.reduce((acc, fk) => {
    acc[fk.from] = fk.table;
    return acc;
  }, {});

  const data = db.prepare(`SELECT * FROM "${table}" ORDER BY createdAt DESC`).all();
  
  res.json({ columns, foreignKeys, data });
};

export const updateRow = async (req, res) => {
  const table = sanitize(req.params.table);
  const id = req.params.id;

  const tables = getTables();
  if (!tables.includes(table)) return res.status(400).json({ error: 'Invalid table' });

  const body = req.body;
  const keys = Object.keys(body).filter(k => k !== 'id' && k !== 'createdAt' && k !== 'updatedAt');
  
  if (keys.length === 0) return res.json({ success: true });

  if (keys.includes('password')) {
    if (body.password) {
      body.password = await argon2.hash(body.password);
    } else {
      keys.splice(keys.indexOf('password'), 1);
    }
  }
  
  if (keys.length === 0) return res.json({ success: true });

  const setString = keys.map(k => `"${sanitize(k)}" = ?`).join(', ');
  const values = keys.map(k => body[k]);
  
  try {
    const result = db.prepare(`UPDATE "${table}" SET ${setString} WHERE id = ?`).run(...values, id);
    if (result.changes === 0) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteRow = (req, res) => {
  const table = sanitize(req.params.table);
  const id = req.params.id;

  const tables = getTables();
  if (!tables.includes(table)) return res.status(400).json({ error: 'Invalid table' });

  try {
    const result = db.prepare(`DELETE FROM "${table}" WHERE id = ?`).run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createRow = async (req, res) => {
  const table = sanitize(req.params.table);
  const tables = getTables();
  if (!tables.includes(table)) return res.status(400).json({ error: 'Invalid table' });

  const body = req.body;
  if (!body.id) body.id = uuid();
  
  const keys = Object.keys(body);
  
  if (keys.includes('password')) {
    if (!body.password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    body.password = await argon2.hash(body.password);
  }

  const columnsString = keys.map(k => `"${sanitize(k)}"`).join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const values = keys.map(k => body[k]);

  try {
    db.prepare(`INSERT INTO "${table}" (${columnsString}) VALUES (${placeholders})`).run(...values);
    res.json({ success: true, id: body.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getRelations = (req, res) => {
  const table = sanitize(req.params.table);
  const tables = getTables();
  if (!tables.includes(table)) return res.status(400).json({ error: 'Invalid table' });

  try {
    const columns = db.prepare(`PRAGMA table_info("${table}")`).all().map(c => c.name);
    let labelCol = 'id';
    if (columns.includes('username')) labelCol = 'username';
    else if (columns.includes('name')) labelCol = 'name';
    else if (columns.includes('title')) labelCol = 'title';

    const data = db.prepare(`SELECT id, "${labelCol}" as label FROM "${table}" ORDER BY label ASC`).all();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createRelation = (req, res) => {
  const { type, tableA, tableB, relationName } = req.body;
  const tA = sanitize(tableA);
  const tB = sanitize(tableB);
  
  if (!tA || !tB) return res.status(400).json({ error: "Invalid tables" });

  const migrateAddColumn = (targetTable, colName, colDef) => {
    db.exec('BEGIN TRANSACTION;');
    try {
      const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(targetTable);
      if (!row) throw new Error("Table not found");
      
      const existingCols = db.prepare(`PRAGMA table_info("${targetTable}")`).all().map(c => c.name.toLowerCase());
      
      const newTableName = `_new_${targetTable}`;
      let sql = row.sql;
      
      sql = sql.replace(new RegExp(`CREATE TABLE "${targetTable}"`, 'i'), `CREATE TABLE "${newTableName}"`);
      sql = sql.replace(new RegExp(`CREATE TABLE ${targetTable}`, 'i'), `CREATE TABLE "${newTableName}"`);
      
      if (existingCols.includes(colName.toLowerCase())) {
        // Upgrade existing column with foreign key constraint
        const regex = new RegExp(`(["']?${colName}["']?\\s+[^,)]+)`, 'i');
        if (sql.match(regex)) {
          sql = sql.replace(regex, `$1 ${colDef}`);
        } else {
          throw new Error(`Column "${colName}" already exists in table "${targetTable}". Please provide a custom Relation Name.`);
        }
      } else {
        // Insert new column definition before the last parenthesis
        const lastParenIndex = sql.lastIndexOf(')');
        sql = sql.slice(0, lastParenIndex) + `, "${colName}" TEXT ${colDef}` + sql.slice(lastParenIndex);
      }
      
      db.exec(sql);
      
      // Fix: Use currentCols instead of existingCols to avoid duplicate identifier syntax error
      const currentCols = db.prepare(`PRAGMA table_info("${targetTable}")`).all().map(c => c.name);
      const colListStr = currentCols.map(c => `"${c}"`).join(', ');
      
      db.exec(`INSERT INTO "${newTableName}" (${colListStr}) SELECT ${colListStr} FROM "${targetTable}";`);
      
      db.exec(`DROP TABLE "${targetTable}";`);
      db.exec(`ALTER TABLE "${newTableName}" RENAME TO "${targetTable}";`);
      
      db.exec('COMMIT;');
    } catch (err) {
      if (db.inTransaction) db.exec('ROLLBACK;');
      throw err;
    }
  };

  try {
    let msg = "";
    if (type === 'One-to-Many') {
      const fkName = sanitize(relationName) || `${tA}Id`;
      migrateAddColumn(tB, fkName, `REFERENCES "${tA}"(id)`);
      msg = `Added ${fkName} to ${tB}`;
    } else if (type === 'Many-to-One') {
      const fkName = sanitize(relationName) || `${tB}Id`;
      migrateAddColumn(tA, fkName, `REFERENCES "${tB}"(id)`);
      msg = `Added ${fkName} to ${tA}`;
    } else if (type === 'One-to-One') {
      const fkName = sanitize(relationName) || `${tB}Id`;
      migrateAddColumn(tA, fkName, `UNIQUE REFERENCES "${tB}"(id)`);
      msg = `Added UNIQUE ${fkName} to ${tA}`;
    } else if (type === 'Many-to-Many') {
      const junctionTable = sanitize(relationName) || `${tA}_${tB}`;
      db.exec(`
        CREATE TABLE IF NOT EXISTS "${junctionTable}" (
          id TEXT PRIMARY KEY,
          "${tA}Id" TEXT REFERENCES "${tA}"(id),
          "${tB}Id" TEXT REFERENCES "${tB}"(id),
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      msg = `Created junction table ${junctionTable}`;
    }
    res.json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllRelations = (req, res) => {
  try {
    const tables = getTables();
    let relations = [];

    tables.forEach(table => {
      const fks = db.prepare(`PRAGMA foreign_key_list("${table}")`).all();
      fks.forEach(fk => {
        relations.push({
          sourceTable: table,
          sourceColumn: fk.from,
          targetTable: fk.table,
          targetColumn: fk.to
        });
      });
    });

    res.json(relations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteRelation = (req, res) => {
  const table = sanitize(req.params.table);
  const column = sanitize(req.params.column);
  
  if (!table || !column) return res.status(400).json({ error: "Invalid parameters" });
  const tables = getTables();
  if (!tables.includes(table)) return res.status(404).json({ error: "Table not found" });

  try {
    const currentColsInfo = db.prepare(`PRAGMA table_info("${table}")`).all();
    if (currentColsInfo.length === 0) return res.status(404).json({ error: "Table not found" });
    
    db.exec('BEGIN TRANSACTION;');

    if (column === 'userId') {
      const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(table);
      const newTableName = `_new_${table}`;
      let sql = row.sql;
      sql = sql.replace(new RegExp(`CREATE TABLE "${table}"`, 'i'), `CREATE TABLE "${newTableName}"`);
      sql = sql.replace(new RegExp(`CREATE TABLE ${table}`, 'i'), `CREATE TABLE "${newTableName}"`);

      // Strip REFERENCES from userId
      const regex = new RegExp(`(["']?${column}["']?\\s+[^,)]+?)\\s+REFERENCES\\s+["']?\\w+["']?\\s*(?:\\(["']?\\w+["']?\\))?(?:\\s+ON\\s+DELETE\\s+\\w+)?(?:\\s+ON\\s+UPDATE\\s+\\w+)?`, 'i');
      if (sql.match(regex)) {
        sql = sql.replace(regex, '$1');
      }
      
      db.exec(sql);
      const colListStr = currentColsInfo.map(c => `"${c.name}"`).join(', ');
      db.exec(`INSERT INTO "${newTableName}" (${colListStr}) SELECT ${colListStr} FROM "${table}";`);
      db.exec(`DROP TABLE "${table}";`);
      db.exec(`ALTER TABLE "${newTableName}" RENAME TO "${table}";`);
    } else {
      // Complete column drop
      const newCols = currentColsInfo.filter(c => c.name !== column);
      const defs = newCols.map(c => {
        let d = `"${c.name}" ${c.type}`;
        if (c.pk) d += " PRIMARY KEY";
        if (c.notnull) d += " NOT NULL";
        if (c.dflt_value) d += ` DEFAULT ${c.dflt_value}`;
        return d;
      });
      
      const newTableName = `_new_${table}`;
      db.exec(`CREATE TABLE "${newTableName}" (${defs.join(', ')});`);
      const colListStr = newCols.map(c => `"${c.name}"`).join(', ');
      if (newCols.length > 0) {
        db.exec(`INSERT INTO "${newTableName}" (${colListStr}) SELECT ${colListStr} FROM "${table}";`);
      }
      db.exec(`DROP TABLE "${table}";`);
      db.exec(`ALTER TABLE "${newTableName}" RENAME TO "${table}";`);
    }

    db.exec('COMMIT;');
    res.json({ success: true });
  } catch (err) {
    if (db.inTransaction) db.exec('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
};
