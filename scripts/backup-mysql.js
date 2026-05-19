require("dotenv").config();

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const mysql = require("mysql2/promise");

const MYSQL_URL = process.env.MYSQL_BACKUP_URL || process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_URL;
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, "..", "backups");
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
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
