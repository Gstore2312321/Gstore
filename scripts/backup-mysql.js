require("dotenv").config();

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const mysql = require("mysql2/promise");

const MYSQL_URL = process.env.MYSQL_BACKUP_URL || process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_URL;
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, "..", "backups");
const BACKUP_COPY_DIR = process.env.BACKUP_COPY_DIR || "";
const BACKUP_RETENTION_DAYS = Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS || 30));
const TABLES = ["categories", "products", "orders", "audit_logs"];

function connectionOptions() {
  if (!MYSQL_URL) {
    throw new Error("Falta MYSQL_BACKUP_URL o MYSQL_URL para crear el backup.");
  }
  const url = new URL(MYSQL_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username || ""),
    password: decodeURIComponent(url.password || ""),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    decimalNumbers: true,
    charset: "utf8mb4"
  };
}

async function main() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  if (BACKUP_COPY_DIR) fs.mkdirSync(BACKUP_COPY_DIR, { recursive: true });
  const connection = await mysql.createConnection(connectionOptions());
  try {
    const backup = {
      created_at: new Date().toISOString(),
      database: connection.config.database,
      tables: {}
    };

    for (const table of TABLES) {
      const [rows] = await connection.execute(`SELECT * FROM \`${table}\``);
      backup.tables[table] = rows;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = path.join(BACKUP_DIR, `gstore-mysql-${stamp}.json.gz`);
    fs.writeFileSync(filePath, zlib.gzipSync(JSON.stringify(backup, null, 2)));
    console.log(`Backup creado: ${filePath}`);
    if (BACKUP_COPY_DIR) {
      const copyPath = path.join(BACKUP_COPY_DIR, path.basename(filePath));
      fs.copyFileSync(filePath, copyPath);
      console.log(`Copia externa creada: ${copyPath}`);
    } else if (process.env.NODE_ENV === "production") {
      console.warn("Configura BACKUP_COPY_DIR para guardar una copia fuera del servidor.");
    }
    cleanupOldBackups(BACKUP_DIR);
    if (BACKUP_COPY_DIR) cleanupOldBackups(BACKUP_COPY_DIR);
  } finally {
    await connection.end();
  }
}

function cleanupOldBackups(dir) {
  const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !/^gstore-mysql-.+\.json\.gz$/.test(entry.name)) continue;
    const filePath = path.join(dir, entry.name);
    const stats = fs.statSync(filePath);
    if (stats.mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      console.log(`Backup antiguo eliminado: ${filePath}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
