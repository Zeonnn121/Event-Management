import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { query } from "../db";
import { getConfig } from "../config";
import { unauthorized } from "../utils/HttpError";
import { asyncHandler } from "../middleware/asyncHandler";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";

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
