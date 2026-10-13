import { Router, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { query } from "../db";
import { badRequest, conflict, notFound, forbidden } from "../utils/HttpError";
import { asyncHandler } from "../middleware/asyncHandler";
import { validate } from "../middleware/validate";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";

const router = Router();

// All routes require auth
router.use(requireAuth);

// ── POST /api/users (super_admin only) ──
// Only super_admin can create users. Council leads and members cannot create other users.
// A super_admin can create: super_admin, council_lead, member.
// Council_lead must be given a council_id at creation or via assign-lead later.
const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["super_admin", "council_lead", "member"]),
  department: z.string().max(100).optional(),
  council_id: z.number().int().positive().nullable().optional(),
});

router.post(
  "/",
  requireSuperAdmin,
  validate(createUserSchema, "body"),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password, role, department, council_id } = req.body;

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

// ── GET /api/users (super_admin only) ──
// Council leads cannot list all users.
router.get(
  "/",
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { role, council_id } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];

    if (role && typeof role === "string") {
      conditions.push("u.role = ?");
      params.push(role);
    }

    if (council_id) {
      conditions.push("u.council_id = ?");
      params.push(Number(council_id));
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
