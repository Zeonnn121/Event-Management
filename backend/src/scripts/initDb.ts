import "dotenv/config";
import mysql from "mysql2/promise";
import path from "path";
import fs from "fs";

const TABLES = [
  "councils",
  "users",
  "events",
  "participants",
  "registrations",
  "attendance",
  "organizers",
  "certificates",
  "event_files",
  "outcomes",
];

async function main() {
  const reset = process.argv.includes("--reset");
  const migrate = process.argv.includes("--migrate");

  if (reset && process.env.NODE_ENV === "production") {
    console.error("Refusing to reset in production.");
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    if (reset) {
      console.log("Resetting database...");
      await conn.query("SET FOREIGN_KEY_CHECKS=0");
      for (const table of TABLES) {
        await conn.query(`DROP TABLE IF EXISTS \`${table}\``);
      }
      await conn.query("SET FOREIGN_KEY_CHECKS=1");
      console.log("All tables dropped.");
    }

    if (migrate && !reset) {
      // Run the v2 migration on an existing database
      console.log("Running v2 migration...");
      const migratePath = path.resolve(__dirname, "../../../database/migrate_v2.sql");
      if (!fs.existsSync(migratePath)) {
        console.error("migrate_v2.sql not found at:", migratePath);
        process.exit(1);
      }
      const migrateSQL = fs.readFileSync(migratePath, "utf-8");
      await conn.query(migrateSQL);
      console.log("Migration v2 applied successfully.");
      return;
    }

    const schemaPath = path.resolve(__dirname, "../../../database/schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf-8");
    await conn.query(schema);
    console.log("Schema applied successfully.");

    // Show tables
    const [rows] = await conn.query("SHOW TABLES");
    console.log("\nTables in database:");
    for (const row of rows as any[]) {
      const tableName = Object.values(row)[0];
      console.log(`  - ${tableName}`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("initDb failed:", err);
  process.exit(1);
});
