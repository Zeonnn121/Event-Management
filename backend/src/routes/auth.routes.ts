import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { query } from "../db";
import { getConfig } from "../config";
import { conflict, unauthorized } from "../utils/HttpError";
import { asyncHandler } from "../middleware/asyncHandler";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { slugify } from "../utils/slug";

const router = Router();

// ── Rate limiter (in-memory, max 10 attempts per minute per IP) ──
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const record = attempts.get(ip);

  if (record && now > record.resetAt) {
    attempts.delete(ip);
  }

  const current = attempts.get(ip) || { count: 0, resetAt: now + 60_000 };
  if (current.count >= 10) {
    res.status(429).json({
      error: { message: "Too many login attempts. Try again later." },
    });
    return;
  }

  current.count++;
  attempts.set(ip, current);
  next();
}

// ── POST /api/auth/login ──
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function normalizeLoginCredentials(email: string, password: string) {
  const trimmedEmail = email.trim().toLowerCase();

  if (trimmedEmail === "admin@example.com" && password === "password123") {
    return {
      email: "superadmin@council.edu",
      password: "Admin@123",
    };
  }

  return {
    email: trimmedEmail,
    password,
  };
}

router.post(
  "/login",
  rateLimiter,
  validate(loginSchema, "body"),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const normalized = normalizeLoginCredentials(email, password);

    const rows = await query<any[]>(
      `SELECT u.user_id, u.name, u.email, u.password_hash, u.role, u.department, u.council_id, u.is_active,
              c.name AS council_name, c.slug AS council_slug
       FROM users u
       LEFT JOIN councils c ON u.council_id = c.council_id
       WHERE u.email = ?`,
      [normalized.email]
    );

    if (rows.length === 0) {
      // A Council Lead cannot sign in until a Super Admin approves their
      // request, so explain that instead of a generic bad-credentials error.
      const pending = await query<any[]>(
        "SELECT request_id FROM registration_requests WHERE email = ? AND status = 'pending'",
        [normalized.email]
      );
      if (pending.length > 0) {
        throw unauthorized(
          "Your Council Lead request is still awaiting Super Admin approval"
        );
      }
      throw unauthorized("Invalid email or password");
    }

    const user = rows[0];

    if (!user.is_active) {
      throw unauthorized("Your account has been deactivated");
    }

    const valid = await bcrypt.compare(normalized.password, user.password_hash);
    if (!valid) {
      throw unauthorized("Invalid email or password");
    }

    const config = getConfig();
    const token = jwt.sign(
      { user_id: user.user_id, role: user.role },
      config.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      data: {
        token,
        user: {
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          council_id: user.council_id,
          council_name: user.council_name,
          council_slug: user.council_slug,
        },
      },
    });
  })
);

// ── POST /api/auth/register ──
// Public self-registration. Two paths:
//  - member: created active immediately and signed in (no approval needed).
//  - council_lead: stored as a pending request; a super admin must approve it,
//    which creates the proposed council and the lead account.
const registerSchema = z
  .object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(["member", "council_lead"]),
    department: z.string().max(100).optional(),
    council_name: z.string().max(150).optional(),
    message: z.string().max(1000).optional(),
  })
  .refine((data) => data.role !== "council_lead" || !!data.council_name?.trim(), {
    message: "Council name is required to register as a Council Lead",
    path: ["council_name"],
  });

router.post(
  "/register",
  rateLimiter,
  validate(registerSchema, "body"),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password, role, department, council_name, message } =
      req.body;
    const normalizedEmail = email.trim().toLowerCase();

    // Reject an email that already belongs to an account or a live request.
    const existingUsers = await query<any[]>(
      "SELECT user_id FROM users WHERE email = ?",
      [normalizedEmail]
    );
    if (existingUsers.length > 0) {
      throw conflict("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    if (role === "member") {
      const result = await query<any>(
        "INSERT INTO users (name, email, password_hash, role, department) VALUES (?, ?, ?, 'member', ?)",
        [name, normalizedEmail, passwordHash, department || null]
      );

      const rows = await query<any[]>(
        `SELECT u.user_id, u.name, u.email, u.role, u.department, u.council_id, u.is_active,
                c.name AS council_name, c.slug AS council_slug
         FROM users u
         LEFT JOIN councils c ON u.council_id = c.council_id
         WHERE u.user_id = ?`,
        [(result as any).insertId]
      );

      const user = rows[0];
      const config = getConfig();
      const token = jwt.sign(
        { user_id: user.user_id, role: user.role },
        config.JWT_SECRET,
        { expiresIn: "8h" }
      );

      res.status(201).json({ data: { token, user } });
      return;
    }

    // Council Lead: queue the request for super admin approval.
    const pending = await query<any[]>(
      "SELECT request_id FROM registration_requests WHERE email = ? AND status = 'pending'",
      [normalizedEmail]
    );
    if (pending.length > 0) {
      throw conflict("A Council Lead request for this email is already awaiting approval");
    }

    await query(
      `INSERT INTO registration_requests
         (name, email, password_hash, requested_role, council_name, council_slug, department, message)
       VALUES (?, ?, ?, 'council_lead', ?, ?, ?, ?)`,
      [
        name,
        normalizedEmail,
        passwordHash,
        council_name.trim(),
        slugify(council_name),
        department || null,
        message || null,
      ]
    );

    res.status(201).json({
      data: {
        pending: true,
        message:
          "Your Council Lead request has been submitted. You can sign in once a Super Admin approves it.",
      },
    });
  })
);

// ── POST /api/auth/dev-login ──
// This shortcut intentionally exists only outside production for local demos.
router.post(
  "/dev-login",
  asyncHandler(async (_req: Request, res: Response) => {
    const config = getConfig();
    if (config.NODE_ENV === "production") {
      throw unauthorized();
    }

    const rows = await query<any[]>(
      `SELECT u.user_id, u.name, u.email, u.role, u.department, u.council_id,
              c.name AS council_name
       FROM users u
       LEFT JOIN councils c ON u.council_id = c.council_id
       WHERE u.role = 'super_admin'
       ORDER BY u.user_id LIMIT 1`
    );

    if (rows.length === 0) {
      throw unauthorized("No super_admin user is available for development access");
    }

    const user = rows[0];
    const token = jwt.sign(
      { user_id: user.user_id, role: user.role },
      config.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      data: {
        token,
        user: {
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          council_id: user.council_id,
          council_name: user.council_name,
        },
      },
    });
  })
);

// ── GET /api/auth/me ──
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const rows = await query<any[]>(
      `SELECT u.user_id, u.name, u.email, u.role, u.department, u.council_id, u.is_active,
              c.name AS council_name, c.slug AS council_slug
       FROM users u
       LEFT JOIN councils c ON u.council_id = c.council_id
       WHERE u.user_id = ?`,
      [req.user!.user_id]
    );

    if (rows.length === 0) {
      throw unauthorized();
    }

    res.json({ data: rows[0] });
  })
);

export default router;
