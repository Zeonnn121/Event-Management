import "dotenv/config";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

async function main() {
  const force = process.argv.includes("--force");

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    const [existing] = await conn.query("SELECT COUNT(*) as cnt FROM users");
    if ((existing as any)[0].cnt > 0 && !force) {
      console.log("Already seeded. Use --force to re-seed.");
      return;
    }

    if (force) {
      console.log("Truncating all tables...");
      await conn.query("SET FOREIGN_KEY_CHECKS=0");
      const tables = [
        "certificates",
        "event_files",
        "outcomes",
        "attendance",
        "registrations",
        "organizers",
        "events",
        "participants",
        "users",
        "councils",
      ];
      for (const t of tables) {
        await conn.query(`TRUNCATE TABLE \`${t}\``);
      }
      await conn.query("SET FOREIGN_KEY_CHECKS=1");
    }

    const hash = (pw: string) => bcrypt.hashSync(pw, 10);

    // ── Councils ──
    const councils = [
      ["Coding Council", "coding", "Building software skills through workshops, hackathons, and competitions."],
      ["Robotics Council", "robotics", "Designing, building and programming robots for competitive and educational events."],
      ["AI/ML Council", "aiml", "Exploring machine learning, deep learning, and AI applications."],
      ["Cybersecurity Council", "cybersecurity", "Ethical hacking, security audits, and digital defense practices."],
      ["Web Development Council", "webdev", "Frontend, backend, and full-stack web development training and events."],
    ];

    for (const c of councils) {
      await conn.query(
        "INSERT INTO councils (name, slug, description, is_active) VALUES (?, ?, ?, TRUE)",
        c
      );
    }
    console.log("Seeded 5 councils.");

    // ── Users ──
    // Super Admin (no council)
    await conn.query(
      "INSERT INTO users (name, email, password_hash, role, council_id, department) VALUES (?, ?, ?, ?, ?, ?)",
      ["Super Admin", "superadmin@council.edu", hash("Admin@123"), "super_admin", null, "Management"]
    );

    // Council Leads (one per council)
    const leadData = [
      ["Coding Lead",      "coding@council.edu",    "Organizer@123", 1, "CSE"],
      ["Robotics Lead",    "robotics@council.edu",  "Organizer@123", 2, "ECE"],
      ["AI/ML Lead",       "aiml@council.edu",      "Organizer@123", 3, "CSE"],
      ["Cybersec Lead",    "cybersec@council.edu",  "Organizer@123", 4, "IT"],
      ["WebDev Lead",      "webdev@council.edu",    "Organizer@123", 5, "CSE"],
    ];
    for (const l of leadData) {
      await conn.query(
        "INSERT INTO users (name, email, password_hash, role, council_id, department) VALUES (?, ?, ?, 'council_lead', ?, ?)",
        [l[0], l[1], hash(l[2] as string), l[3], l[4]]
      );
    }

    // Member
    await conn.query(
      "INSERT INTO users (name, email, password_hash, role, council_id, department) VALUES (?, ?, ?, ?, ?, ?)",
      ["Member User", "member@council.edu", hash("Member@123"), "member", null, "ECE"]
    );
    console.log("Seeded 7 users (1 super_admin, 5 council_leads, 1 member).");

    // ── Participants ──
    const departments = ["CSE", "IT", "ECE", "MECH"];
    const participants: any[] = [];
    for (let i = 1; i <= 20; i++) {
      participants.push([
        `Participant ${i}`,
        `participant${i}@student.edu`,
        departments[(i - 1) % 4],
        ((i - 1) % 4) + 1,
        `98765${String(10000 + i).slice(0, 5)}`,
      ]);
    }
    for (const p of participants) {
      await conn.query(
        "INSERT INTO participants (name, email, department, year, phone) VALUES (?, ?, ?, ?, ?)",
        p
      );
    }
    console.log("Seeded 20 participants.");

    // ── Events ──
    // Events distributed across councils
    // Users: super_admin=1, coding_lead=2, robotics_lead=3, aiml_lead=4, cybersec_lead=5, webdev_lead=6, member=7
    const events: any[] = [
      // Council 1 (Coding) — completed
      [
        "Web Development Workshop", "Hands-on workshop on React and Node.js",
        "Workshop", "2024-03-15", "09:00:00", "12:00:00", "Seminar Hall A",
        2, 100, "2024-03-10", "completed", 1, 1
      ],
      // Council 1 (Coding) — completed
      [
        "Code Sprint Hackathon", "24-hour hackathon for all branches",
        "Hackathon", "2024-09-20", "08:00:00", "08:00:00",
        "Lab Block B", 2, 60, "2024-09-15", "completed", 1, 1
      ],
      // Council 3 (AI/ML) — completed
      [
        "AI & ML Seminar", "Introduction to machine learning concepts",
        "Seminar", "2025-01-25", "10:00:00", "13:00:00", "Seminar Hall A",
        4, 150, "2025-01-20", "completed", 3, 1
      ],
      // Council 1 (Coding) — registration_open
      [
        "Tech Innovation Competition", "Pitch your innovation idea",
        "Competition", "2026-04-10", "14:00:00", "17:00:00", "Auditorium",
        2, 80, "2026-04-05", "registration_open", 1, 1
      ],
      // Council 5 (WebDev) — planned
      [
        "Cloud Computing Workshop", "AWS basics and hands-on labs",
        "Workshop", "2026-08-20", "09:00:00", "12:00:00", "Lab Block C",
        6, 50, "2026-08-15", "planned", 5, 1
      ],
      // Council 4 (Cybersec) — completed
      [
        "Cyber Security Seminar", "Ethical hacking and security practices",
        "Seminar", "2025-11-05", "11:00:00", "13:30:00", "Auditorium",
        5, 120, "2025-10-30", "completed", 4, 1
      ],
      // Council 2 (Robotics) — planned
      [
        "Robotics Design Workshop", "Learn to build autonomous robots",
        "Workshop", "2026-09-15", "10:00:00", "16:00:00", "Lab Block D",
        3, 40, "2026-09-10", "planned", 2, 1
      ],
    ];

    for (const e of events) {
      await conn.query(
        `INSERT INTO events (title, description, category, event_date, start_time, end_time, venue, coordinator_id, capacity, registration_deadline, status, council_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        e
      );
    }
    console.log("Seeded 7 events across 4 councils.");

    // ── Organizers ──
    for (let eid = 1; eid <= 7; eid++) {
      const leadId = [2, 2, 4, 2, 6, 5, 3][eid - 1];
      await conn.query(
        "INSERT INTO organizers (event_id, user_id, responsibility) VALUES (?, ?, ?)",
        [eid, leadId, "Lead organizer"]
      );
    }
    console.log("Seeded organizers.");

    // ── Registrations ──
    const regData: { eventId: number; count: number }[] = [
      { eventId: 1, count: 10 },
      { eventId: 2, count: 12 },
      { eventId: 3, count: 8 },
      { eventId: 4, count: 10 },
      { eventId: 6, count: 11 },
    ];
    let pOffset = 0;
    for (const rd of regData) {
      for (let i = 0; i < rd.count; i++) {
        const pid = ((pOffset + i) % 20) + 1;
        try {
          await conn.query(
            "INSERT INTO registrations (event_id, participant_id, status) VALUES (?, ?, 'registered')",
            [rd.eventId, pid]
          );
        } catch {
          // skip duplicates
        }
      }
      pOffset += rd.count;
    }
    console.log("Seeded registrations.");

    // ── Attendance ──
    const attEvents = [
      { eventId: 1, present: 8, absent: 2 },
      { eventId: 2, present: 10, absent: 2 },
      { eventId: 3, present: 7, absent: 1 },
      { eventId: 6, present: 9, absent: 2 },
    ];
    for (const ae of attEvents) {
      const [rows] = await conn.query(
        "SELECT participant_id FROM registrations WHERE event_id = ? AND status = 'registered' ORDER BY registration_id",
        [ae.eventId]
      );
      const pids = (rows as any[]).map((r) => r.participant_id);
      for (let i = 0; i < pids.length; i++) {
        const present = i < ae.present ? 1 : 0;
        await conn.query(
          "INSERT INTO attendance (event_id, participant_id, present) VALUES (?, ?, ?)",
          [ae.eventId, pids[i], present]
        );
      }
    }
    console.log("Seeded attendance.");

    // ── Outcomes ──
    const outcomeData = [
      [1, 8, 4.2, "Team Alpha", "Great workshop turnout"],
      [2, 10, 4.5, "Team Beta", "Innovative solutions presented"],
      [3, 7, 4.0, null, "Informative session on AI trends"],
      [6, 9, 4.3, null, "Security awareness improved"],
    ];
    for (const o of outcomeData) {
      await conn.query(
        "INSERT INTO outcomes (event_id, participants_count, feedback_score, winners, description) VALUES (?, ?, ?, ?, ?)",
        o
      );
    }
    console.log("Seeded outcomes.");

    // ── Certificates ──
    const certData = [
      ["TC-2024-E001-P0001", 1, 1, null, "pending", null],
      ["TC-2024-E001-P0002", 1, 2, null, "pending", null],
      ["TC-2024-E002-P0003", 2, 3, "certs/event-2/TC-2024-E002-P0003.pdf", "issued", "2024-10-01"],
      ["TC-2025-E003-P0004", 3, 4, "certs/event-3/TC-2025-E003-P0004.pdf", "issued", "2025-02-10"],
      ["TC-2025-E006-P0005", 6, 5, null, "pending", null],
    ];
    for (const c of certData) {
      await conn.query(
        "INSERT INTO certificates (certificate_code, event_id, participant_id, s3_key, status, issued_date) VALUES (?, ?, ?, ?, ?, ?)",
        c
      );
    }
    console.log("Seeded certificates.");

    console.log("\n=== Seeding complete! ===");
    console.log("\nLogin credentials:");
    console.log("  Super Admin:     superadmin@council.edu / Admin@123");
    console.log("  Coding Lead:     coding@council.edu / Organizer@123");
    console.log("  Robotics Lead:   robotics@council.edu / Organizer@123");
    console.log("  AI/ML Lead:      aiml@council.edu / Organizer@123");
    console.log("  Cybersec Lead:   cybersec@council.edu / Organizer@123");
    console.log("  WebDev Lead:     webdev@council.edu / Organizer@123");
    console.log("  Member:          member@council.edu / Member@123");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
