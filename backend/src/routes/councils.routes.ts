import { Router, Request, Response } from "express";
import { z } from "zod";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { query } from "../db";
import { badRequest, conflict, notFound } from "../utils/HttpError";
import { asyncHandler } from "../middleware/asyncHandler";
import { validate } from "../middleware/validate";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";

const router = Router();

// All council routes require auth
router.use(requireAuth);

// ── Schemas ──

const councilCreateSchema = z.object({
  name: z.string().min(1).max(150),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, or hyphens"),
  description: z.string().optional(),
  is_active: z.boolean().optional().default(true),
});

const councilUpdateSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().optional(),
});

const councilStatusSchema = z.object({
  is_active: z.boolean(),
});

const assignLeadSchema = z.object({
  user_id: z.number().int().positive(),
});

// ── GET /api/councils ──
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const includeInactive =
      req.user?.role === "super_admin" && req.query.include_inactive === "true";

    const where = includeInactive ? "" : "WHERE c.is_active = TRUE";

    const rows = await query<RowDataPacket[]>(
      `SELECT
         c.council_id, c.name, c.slug, c.description, c.is_active,
         c.created_at, c.updated_at,
         u.user_id AS lead_user_id, u.name AS lead_name, u.email AS lead_email,
         (SELECT COUNT(*) FROM events e WHERE e.council_id = c.council_id) AS event_count,
         (SELECT COUNT(*) FROM users m WHERE m.council_id = c.council_id) AS member_count
       FROM councils c
       LEFT JOIN users u ON u.council_id = c.council_id AND u.role = 'council_lead' AND u.is_active = TRUE
       ${where}
       ORDER BY c.name ASC`
    );

    res.json({ data: rows });
  })
);

// ── POST /api/councils (super_admin) ──
router.post(
  "/",
  requireSuperAdmin,
  validate(councilCreateSchema, "body"),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, slug, description, is_active } = req.body;

    try {
      const result = await query<ResultSetHeader>(
        `INSERT INTO councils (name, slug, description, is_active) VALUES (?, ?, ?, ?)`,
        [name, slug, description || null, is_active ?? true]
      );

      const created = await query<RowDataPacket[]>(
        "SELECT * FROM councils WHERE council_id = ?",
        [result.insertId]
      );

      res.status(201).json({ data: created[0] });
    } catch (err: any) {
      if (err.code === "ER_DUP_ENTRY") {
        throw conflict("A council with this slug already exists");
      }
      throw err;
    }
  })
);

// ── GET /api/councils/:id ──
router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const councilId = Number(req.params.id);
    if (!councilId) throw badRequest("Invalid council ID");

    const rows = await query<RowDataPacket[]>(
      `SELECT
         c.council_id, c.name, c.slug, c.description, c.is_active,
         c.created_at, c.updated_at,
         u.user_id AS lead_user_id, u.name AS lead_name, u.email AS lead_email,
         u.is_active AS lead_is_active
       FROM councils c
       LEFT JOIN users u ON u.council_id = c.council_id AND u.role = 'council_lead'
       WHERE c.council_id = ?`,
      [councilId]
    );

    if (rows.length === 0) throw notFound("Council not found");

    // Council leads can only see their own council
    if (
      req.user?.role === "council_lead" &&
      req.user?.council_id !== councilId
    ) {
      throw notFound("Council not found");
    }

    res.json({ data: rows[0] });
  })
);

// ── PUT /api/councils/:id (super_admin) ──
router.put(
  "/:id",
  requireSuperAdmin,
  validate(councilUpdateSchema, "body"),
  asyncHandler(async (req: Request, res: Response) => {
    const councilId = Number(req.params.id);
    if (!councilId) throw badRequest("Invalid council ID");

    const existing = await query<RowDataPacket[]>(
      "SELECT * FROM councils WHERE council_id = ?",
      [councilId]
    );
    if (existing.length === 0) throw notFound("Council not found");

    const allowedFields = ["name", "slug", "description"];
    const setClauses: string[] = [];
    const setParams: (string | boolean | null)[] = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        setParams.push(req.body[field] ?? null);
      }
    }

    if (setClauses.length > 0) {
      try {
        await query(
          `UPDATE councils SET ${setClauses.join(", ")} WHERE council_id = ?`,
          [...setParams, councilId]
        );
      } catch (err: any) {
        if (err.code === "ER_DUP_ENTRY") {
          throw conflict("A council with this slug already exists");
        }
        throw err;
      }
    }

    const updated = await query<RowDataPacket[]>(
      "SELECT * FROM councils WHERE council_id = ?",
      [councilId]
    );

    res.json({ data: updated[0] });
  })
);

// ── PATCH /api/councils/:id/status (super_admin) ──
router.patch(
  "/:id/status",
  requireSuperAdmin,
  validate(councilStatusSchema, "body"),
  asyncHandler(async (req: Request, res: Response) => {
    const councilId = Number(req.params.id);
    if (!councilId) throw badRequest("Invalid council ID");

    const rows = await query<RowDataPacket[]>(
      "SELECT council_id FROM councils WHERE council_id = ?",
      [councilId]
    );
    if (rows.length === 0) throw notFound("Council not found");

    await query("UPDATE councils SET is_active = ? WHERE council_id = ?", [
      req.body.is_active,
      councilId,
    ]);

    const updated = await query<RowDataPacket[]>(
      "SELECT * FROM councils WHERE council_id = ?",
      [councilId]
    );

    res.json({ data: updated[0] });
  })
);

// ── DELETE /api/councils/:id (super_admin) ──
// Refuses to delete a council that still has events or people in it, so nothing
// is silently orphaned. Empty it first: detach its members with
// DELETE /api/users/:id/council and delete its events.
router.delete(
  "/:id",
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const councilId = Number(req.params.id);
    if (!councilId) throw badRequest("Invalid council ID");

    const rows = await query<RowDataPacket[]>(
      "SELECT council_id, name FROM councils WHERE council_id = ?",
      [councilId]
    );
    if (rows.length === 0) throw notFound("Council not found");

    const [eventRows, userRows] = await Promise.all([
      query<RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM events WHERE council_id = ?",
        [councilId]
      ),
      query<RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM users WHERE council_id = ?",
        [councilId]
      ),
    ]);

    const eventCount = Number(eventRows[0].count);
    const userCount = Number(userRows[0].count);

    if (eventCount > 0 || userCount > 0) {
      throw conflict(
        `"${rows[0].name}" is not empty: it still has ${eventCount} event(s) and ` +
          `${userCount} member(s). Remove its members and delete its events first.`,
        { event_count: eventCount, user_count: userCount }
      );
    }

    await query("DELETE FROM councils WHERE council_id = ?", [councilId]);
    res.status(204).send();
  })
);

// ── POST /api/councils/:id/assign-lead (super_admin) ──
// Assigns an existing council_lead user to this council.
// Removes them from any prior council first.
router.post(
  "/:id/assign-lead",
  requireSuperAdmin,
  validate(assignLeadSchema, "body"),
  asyncHandler(async (req: Request, res: Response) => {
    const councilId = Number(req.params.id);
    if (!councilId) throw badRequest("Invalid council ID");

    const councilRows = await query<RowDataPacket[]>(
      "SELECT council_id FROM councils WHERE council_id = ?",
      [councilId]
    );
    if (councilRows.length === 0) throw notFound("Council not found");

    const { user_id } = req.body;

    const userRows = await query<RowDataPacket[]>(
      "SELECT user_id, role FROM users WHERE user_id = ?",
      [user_id]
    );
    if (userRows.length === 0) throw notFound("User not found");

    if (userRows[0].role !== "council_lead") {
      throw badRequest("Only council_lead users can be assigned to a council");
    }

    // Unassign any existing lead from this council first
    await query(
      "UPDATE users SET council_id = NULL WHERE council_id = ? AND role = 'council_lead'",
      [councilId]
    );

    // Assign the new lead
    await query("UPDATE users SET council_id = ? WHERE user_id = ?", [
      councilId,
      user_id,
    ]);

    res.json({ data: { message: "Council lead assigned successfully", council_id: councilId, user_id } });
  })
);

// ── GET /api/councils/:id/stats ──
// Returns stats scoped to a single council.
// Super admin can view any; council_lead only their own.
router.get(
  "/:id/stats",
  asyncHandler(async (req: Request, res: Response) => {
    const councilId = Number(req.params.id);
    if (!councilId) throw badRequest("Invalid council ID");

    // Access control
    if (
      req.user?.role === "council_lead" &&
      req.user?.council_id !== councilId
    ) {
      throw notFound("Council not found");
    }

    const councilRows = await query<RowDataPacket[]>(
      "SELECT council_id, name FROM councils WHERE council_id = ?",
      [councilId]
    );
    if (councilRows.length === 0) throw notFound("Council not found");

    const [
      totalEvents,
      upcomingEvents,
      ongoingEvents,
      completedEvents,
      cancelledEvents,
      totalRegistrations,
      certificatesIssued,
      recentEvents,
    ] = await Promise.all([
      query<RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM events WHERE council_id = ?",
        [councilId]
      ),
      query<RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM events WHERE council_id = ? AND event_date >= CURDATE() AND status IN ('planned','registration_open')",
        [councilId]
      ),
      query<RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM events WHERE council_id = ? AND status = 'ongoing'",
        [councilId]
      ),
      query<RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM events WHERE council_id = ? AND status = 'completed'",
        [councilId]
      ),
      query<RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM events WHERE council_id = ? AND status = 'cancelled'",
        [councilId]
      ),
      query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM registrations r
         JOIN events e ON r.event_id = e.event_id
         WHERE e.council_id = ? AND r.status = 'registered'`,
        [councilId]
      ),
      query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM certificates c
         JOIN events e ON c.event_id = e.event_id
         WHERE e.council_id = ? AND c.status = 'issued'`,
        [councilId]
      ),
      query<RowDataPacket[]>(
        `SELECT e.event_id, e.title, e.event_date, e.status, e.category,
                (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.event_id AND r.status = 'registered') AS registration_count
         FROM events e
         WHERE e.council_id = ?
         ORDER BY e.event_date DESC
         LIMIT 10`,
        [councilId]
      ),
    ]);

    res.json({
      data: {
        council: councilRows[0],
        total_events: Number(totalEvents[0].count),
        upcoming_events: Number(upcomingEvents[0].count),
        ongoing_events: Number(ongoingEvents[0].count),
        completed_events: Number(completedEvents[0].count),
        cancelled_events: Number(cancelledEvents[0].count),
        total_registrations: Number(totalRegistrations[0].count),
        certificates_issued: Number(certificatesIssued[0].count),
        recent_events: recentEvents,
      },
    });
  })
);

export default router;
