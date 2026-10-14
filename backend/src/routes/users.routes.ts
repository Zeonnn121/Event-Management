import { Router, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { query } from "../db";
import { badRequest, conflict, notFound, forbidden } from "../utils/HttpError";
import { asyncHandler } from "../middleware/asyncHandler";
import { validate } from "../middleware/validate";
import { requireAuth, requireRole, requireSuperAdmin } from "../middleware/auth";

const router = Router();

// All routes require auth
router.use(requireAuth);

// ── POST /api/users (super_admin, or council_lead for their own committee) ──
// A super_admin can create: super_admin, council_lead, council_member, member.
// A council_lead can only create council_member, and they are always placed in
// the lead's own council (any client-sent role/council_id is ignored).
// A council_lead must be given a council_id at creation or via assign-lead later.
const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["super_admin", "council_lead", "council_member", "member"]),
  department: z.string().max(100).optional(),
  council_id: z.number().int().positive().nullable().optional(),
});

router.post(
  "/",
  requireRole("super_admin", "council_lead"),
  validate(createUserSchema, "body"),
  asyncHandler(async (req: Request, res: Response) => {
    let { name, email, password, role, department, council_id } = req.body;

    if (req.user!.role === "council_lead") {
      if (!req.user!.council_id) {
        throw badRequest(
          "Your account is not assigned to a council. Contact the Super Admin."
        );
      }
      // Council leads only ever add council members to their own council.
      role = "council_member";
      council_id = req.user!.council_id;
    }

    // If council_lead, validate council exists (if provided)
    if (council_id) {
      const councilRows = await query<any[]>(
        "SELECT council_id FROM councils WHERE council_id = ?",
        [council_id]
      );
      if (councilRows.length === 0) throw notFound("Council not found");

      // Check council doesn't already have an active lead
      if (role === "council_lead") {
        const existingLead = await query<any[]>(
          "SELECT user_id FROM users WHERE council_id = ? AND role = 'council_lead' AND is_active = TRUE",
          [council_id]
        );
        if (existingLead.length > 0) {
          throw conflict("This council already has an active lead. Deactivate or reassign the existing lead first.");
        }
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const result = await query<any>(
        "INSERT INTO users (name, email, password_hash, role, department, council_id) VALUES (?, ?, ?, ?, ?, ?)",
        [name, email, passwordHash, role, department || null, council_id || null]
      );

      const rows = await query<any[]>(
        `SELECT u.user_id, u.name, u.email, u.role, u.department, u.council_id, u.is_active, u.created_at,
                c.name AS council_name
         FROM users u
         LEFT JOIN councils c ON u.council_id = c.council_id
         WHERE u.user_id = ?`,
        [(result as any).insertId]
      );

      res.status(201).json({ data: rows[0] });
    } catch (err: any) {
      if (err.code === "ER_DUP_ENTRY") {
        throw conflict("A user with this email already exists");
      }
      throw err;
    }
  })
);

// ── GET /api/users (super_admin; council_lead sees only their own council) ──
router.get(
  "/",
  requireRole("super_admin", "council_lead"),
  asyncHandler(async (req: Request, res: Response) => {
    const { role, council_id } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];

    if (req.user!.role === "council_lead") {
      // Scope a lead to their own council, ignoring any requested council filter.
      if (!req.user!.council_id) {
        res.json({ data: [] });
        return;
      }
      conditions.push("u.council_id = ?");
      params.push(req.user!.council_id);
    } else {
      if (role && typeof role === "string") {
        conditions.push("u.role = ?");
        params.push(role);
      }

      if (council_id) {
        conditions.push("u.council_id = ?");
        params.push(Number(council_id));
      }
    }

    const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    const rows = await query<any[]>(
      `SELECT u.user_id, u.name, u.email, u.role, u.department, u.council_id, u.is_active, u.created_at,
              c.name AS council_name, c.slug AS council_slug
       FROM users u
       LEFT JOIN councils c ON u.council_id = c.council_id
       ${where}
       ORDER BY u.created_at DESC`,
      params
    );

    res.json({ data: rows });
  })
);

// ── GET /api/users/:id (super_admin) ──
router.get(
  "/:id",
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.params.id);
    if (!userId) throw badRequest("Invalid user ID");

    const rows = await query<any[]>(
      `SELECT u.user_id, u.name, u.email, u.role, u.department, u.council_id, u.is_active, u.created_at,
              c.name AS council_name, c.slug AS council_slug
       FROM users u
       LEFT JOIN councils c ON u.council_id = c.council_id
       WHERE u.user_id = ?`,
      [userId]
    );

    if (rows.length === 0) throw notFound("User not found");

    res.json({ data: rows[0] });
  })
);

// ── PUT /api/users/:id (super_admin only) ──
// Super admin can update name, email, department, is_active.
// Role and council_id changes are separate controlled endpoints.
const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  department: z.string().max(100).optional(),
  is_active: z.boolean().optional(),
});

router.put(
  "/:id",
  requireSuperAdmin,
  validate(updateUserSchema, "body"),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.params.id);
    if (!userId) throw badRequest("Invalid user ID");

    // Prevent deactivating yourself
    if (req.body.is_active === false && req.user!.user_id === userId) {
      throw badRequest("You cannot deactivate your own account");
    }

    const existing = await query<any[]>(
      "SELECT user_id FROM users WHERE user_id = ?",
      [userId]
    );
    if (existing.length === 0) throw notFound("User not found");

    const allowedFields = ["name", "email", "department", "is_active"];
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
          `UPDATE users SET ${setClauses.join(", ")} WHERE user_id = ?`,
          [...setParams, userId]
        );
      } catch (err: any) {
        if (err.code === "ER_DUP_ENTRY") {
          throw conflict("A user with this email already exists");
        }
        throw err;
      }
    }

    const updated = await query<any[]>(
      `SELECT u.user_id, u.name, u.email, u.role, u.department, u.council_id, u.is_active, u.created_at,
              c.name AS council_name
       FROM users u
       LEFT JOIN councils c ON u.council_id = c.council_id
       WHERE u.user_id = ?`,
      [userId]
    );

    res.json({ data: updated[0] });
  })
);

// ── DELETE /api/users/:id/council (super_admin, or council_lead for own council) ──
// Removes a user from their council but keeps the account: they are detached and
// become a plain member. This is the supported way to empty a council, because
// DELETE /api/councils/:id is refused while anyone still belongs to it.
router.delete(
  "/:id/council",
  requireRole("super_admin", "council_lead"),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.params.id);
    if (!userId) throw badRequest("Invalid user ID");

    const rows = await query<any[]>(
      "SELECT user_id, name, role, council_id FROM users WHERE user_id = ?",
      [userId]
    );
    if (rows.length === 0) throw notFound("User not found");

    const target = rows[0];
    if (target.council_id === null) {
      throw badRequest("This user is not in a council");
    }

    if (req.user!.role === "council_lead") {
      if (!req.user!.council_id) {
        throw badRequest(
          "Your account is not assigned to a council. Contact the Super Admin."
        );
      }
      // Leads can only remove council members, and only from their own council.
      // Another council's users are hidden behind a 404.
      if (target.council_id !== req.user!.council_id) {
        throw notFound("User not found");
      }
      if (target.role !== "council_member") {
        throw forbidden("Council leads can only remove council members");
      }
    }

    await query(
      "UPDATE users SET council_id = NULL, role = 'member' WHERE user_id = ?",
      [userId]
    );

    res.json({
      data: {
        user_id: userId,
        name: target.name,
        role: "member",
        council_id: null,
        message: "Removed from council",
      },
    });
  })
);

// ── POST /api/users/:id/reset-password (super_admin) ──
const resetPasswordSchema = z.object({
  new_password: z.string().min(8),
});

router.post(
  "/:id/reset-password",
  requireSuperAdmin,
  validate(resetPasswordSchema, "body"),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.params.id);
    if (!userId) throw badRequest("Invalid user ID");

    const rows = await query<any[]>(
      "SELECT user_id FROM users WHERE user_id = ?",
      [userId]
    );
    if (rows.length === 0) throw notFound("User not found");

    const hash = await bcrypt.hash(req.body.new_password, 10);
    await query("UPDATE users SET password_hash = ? WHERE user_id = ?", [
      hash,
      userId,
    ]);

    res.json({ data: { message: "Password reset successfully" } });
  })
);

export default router;
