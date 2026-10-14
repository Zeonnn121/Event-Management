import "dotenv/config";
import mysql from "mysql2/promise";

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [count] = await conn.query<any[]>("SELECT COUNT(*) AS c, MAX(event_id) AS max_id FROM events");
  console.log("events total:", count[0].c, "max event_id:", count[0].max_id);

  const [rows] = await conn.query<any[]>(
    `SELECT event_id, title, event_date, start_time, end_time, status, council_id, created_by, created_at
     FROM events ORDER BY event_id DESC LIMIT 8`
  );
  console.log("latest events:", JSON.stringify(rows, null, 2));

  const [byUser] = await conn.query<any[]>(
    "SELECT created_by, COUNT(*) AS c FROM events GROUP BY created_by"
  );
  console.log("events by creator:", JSON.stringify(byUser));

  const [users] = await conn.query<any[]>(
    "SELECT user_id, email, role, council_id FROM users WHERE role IN ('super_admin','council_lead') ORDER BY user_id"
  );
  console.log("admin/lead users:", JSON.stringify(users));

  await conn.end();
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
