import { Router, Request, Response } from "express";
import { z } from "zod";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getPool, query } from "../db";
import { badRequest, conflict, notFound } from "../utils/HttpError";
import { asyncHandler } from "../middleware/asyncHandler";
import { validate } from "../middleware/validate";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";
import { slugify } from "../utils/slug";

const router = Router();

// Every route here is Super Admin only: this is the approval queue for
// people who asked to become a Council Lead.
router.use(requireAuth, requireSuperAdmin);

// ── Helpers ──

/** Finds a slug that no council is using yet, by appending -2, -3, ... */
async function uniqueCouncilSlug(
  conn: { query: (sql: string, params?: unknown[]) => Promise<[RowDataPacket[], unknown]> },
  base: string,
  excludeId?: number
): Promise<string> {
  const candidate = base || "council";
  for (let i = 0; i < 100; i++) {
    const slug = i === 0 ? candidate : `${candidate}-${i + 1}`;
    const [rows] = await conn.query(
      "SELECT council_id FROM councils WHERE slug = ?",
      [slug]
    );
    if (rows.length === 0 || (excludeId && rows[0].council_id === excludeId)) {
      return slug;
    }
  }
  throw conflict("Could not generate a unique council slug");
}

// ── Schemas ──

const listQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "all"]).optional(),
});

const approveSchema = z.object({
  // Optional overrides so the Super Admin can rename the proposed council
  // while approving instead of rejecting and asking for a fix.
  council_name: z.string().min(1).max(150).optional(),
  council_slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, or hyphens")
    .optional(),
});

const rejectSchema = z.object({
  reason: z.string().max(255).optional(),
});

// ── GET /api/registration-requests ──
// Lists requests (defaults to pending) together with the reviewer's name.
router.get(
  "/",
  validate(listQuerySchema, "query"),
  asyncHandler(async (req: Request, res: Response) => {
    const status = (req.query.status as string) || "pending";

    const where = status === "all" ? "" : "WHERE r.status = ?";
    const params = status === "all" ? [] : [status];

    const rows = await query<RowDataPacket[]>(
      `SELECT r.request_id, r.name, r.email, r.requested_role, r.council_name,
              r.council_slug, r.department, r.message, r.status, r.requested_at,
              r.reviewed_at, r.review_note,
              reviewer.name AS reviewed_by_name
       FROM registration_requests r
       LEFT JOIN users reviewer ON r.reviewed_by = reviewer.user_id
       ${where}
       ORDER BY r.requested_at DESC`,
      params
    );

    res.json({ data: rows });
  })
);

// ── POST /api/registration-requests/:id/approve ──
// Creates the proposed council and the Council Lead user, then marks the
// request approved. Runs in one transaction so a half-created council can
// never be left behind.
router.post(
  "/:id/approve",
  validate(approveSchema, "body"),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = Number(req.params.id);
    if (!requestId) throw badRequest("Invalid request ID");

    const { council_name, council_slug } = req.body;

    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();

      const [reqRows] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM registration_requests WHERE request_id = ? FOR UPDATE",
        [requestId]
      );
      if (reqRows.length === 0) throw notFound("Registration request not found");

      const request = reqRows[0];
      if (request.status !== "pending") {
        throw conflict(`This request has already been ${request.status}`);
      }

      // The email may have been taken since the request was submitted.
      const [existingUsers] = await conn.query<RowDataPacket[]>(
        "SELECT user_id FROM users WHERE email = ?",
        [request.email]
      );
      if (existingUsers.length > 0) {
        throw conflict("A user with this email already exists");
      }

      const name = council_name ?? request.council_name;
      const slug = council_slug ?? slugify(request.council_slug || request.council_name);

      // If the requested slug is taken, fall back to a suffixed variant rather
      // than failing the approval.
      const [slugRows] = await conn.query<RowDataPacket[]>(
        "SELECT council_id FROM councils WHERE slug = ?",
        [slug]
      );
      const finalSlug =
        slugRows.length === 0 ? slug : await uniqueCouncilSlug(conn, slug);

      const [councilResult] = await conn.query<ResultSetHeader>(
        "INSERT INTO councils (name, slug, description, is_active) VALUES (?, ?, ?, TRUE)",
        [name, finalSlug, request.message || null]
      );

      await conn.query(
        `INSERT INTO users (name, email, password_hash, role, council_id, department)
         VALUES (?, ?, ?, 'council_lead', ?, ?)`,
        [
          request.name,
          request.email,
          request.password_hash,
          councilResult.insertId,
          request.department || null,
        ]
      );

      await conn.query(
        `UPDATE registration_requests
         SET status = 'approved', reviewed_by = ?, reviewed_at = NOW()
         WHERE request_id = ?`,
        [req.user!.user_id, requestId]
      );

      await conn.commit();

      res.json({
        data: {
          request_id: requestId,
          status: "approved",
          council_id: councilResult.insertId,
          council_name: name,
          council_slug: finalSlug,
        },
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// ── POST /api/registration-requests/:id/reject ──
router.post(
  "/:id/reject",
  validate(rejectSchema, "body"),
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = Number(req.params.id);
    if (!requestId) throw badRequest("Invalid request ID");

    const rows = await query<RowDataPacket[]>(
      "SELECT status FROM registration_requests WHERE request_id = ?",
      [requestId]
    );
    if (rows.length === 0) throw notFound("Registration request not found");
    if (rows[0].status !== "pending") {
      throw conflict(`This request has already been ${rows[0].status}`);
    }

    await query(
      `UPDATE registration_requests
       SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), review_note = ?
       WHERE request_id = ?`,
      [req.user!.user_id, req.body.reason || null, requestId]
    );

    res.json({ data: { request_id: requestId, status: "rejected" } });
  })
);

export default router;
