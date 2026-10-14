import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getConfig } from "../config";
import { unauthorized, forbidden } from "../utils/HttpError";
import { query } from "../db";

export interface AuthUser {
  user_id: number;
  role: "super_admin" | "council_lead" | "council_member" | "member";
  email: string;
  name: string;
  council_id: number | null;
  is_active: boolean;
}

// Augment Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface JwtPayload {
  user_id: number;
  role: string;
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw unauthorized();
    }

    const token = authHeader.slice(7);
    const config = getConfig();
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

    const rows = await query<any[]>(
      "SELECT user_id, role, email, name, council_id, is_active FROM users WHERE user_id = ?",
      [payload.user_id]
    );

    if (rows.length === 0) {
      throw unauthorized();
    }

    const user = rows[0];

    if (!user.is_active) {
      throw unauthorized("Your account has been deactivated");
    }

    req.user = user as AuthUser;
    next();
  } catch (err) {
    if (err instanceof Error && err.name === "JsonWebTokenError") {
      return next(unauthorized());
    }
    if (err instanceof Error && err.name === "TokenExpiredError") {
      return next(unauthorized());
    }
    next(err);
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(forbidden());
    }
    next();
  };
}

/** Super Admin only */
export function requireSuperAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== "super_admin") return next(forbidden());
  next();
}

/**
 * For council leads: checks that the event identified by req.params.eventId
 * (or the eventId parameter) belongs to the lead's council.
 * Super admin bypasses this check.
 * Pass `eventIdParam` to override the default param name 'id'.
 */
export function requireCouncilEventAccess(eventIdParam = "id") {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) return next(unauthorized());

    // Super admin has unrestricted access
    if (req.user.role === "super_admin") {
      return next();
    }

    // Read-only roles cannot manage events
    if (req.user.role === "member" || req.user.role === "council_member") {
      return next(forbidden());
    }

    // Council leads: verify event belongs to their council
    const eventId = Number(req.params[eventIdParam]);
    if (!eventId) return next();

    const rows = await query<any[]>(
      "SELECT council_id FROM events WHERE event_id = ?",
      [eventId]
    );

    if (rows.length === 0) {
      // Let the actual route handle 404
      return next();
    }

    const eventCouncilId = rows[0].council_id;

    if (eventCouncilId === null || eventCouncilId !== req.user.council_id) {
      // Return 404 to avoid leaking the existence of another council's event
      return next(require("../utils/HttpError").notFound("Event not found"));
    }

    next();
  };
}

/**
 * Verifies that a file (event_file) belongs to the council lead's council.
 * Super admin bypasses.
 */
export function requireCouncilFileAccess(fileIdParam = "fileId") {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) return next(unauthorized());
    if (req.user.role === "super_admin") return next();
    if (req.user.role === "member" || req.user.role === "council_member") {
      return next(forbidden());
    }

    const fileId = Number(req.params[fileIdParam]);
    if (!fileId) return next();

    const rows = await query<any[]>(
      `SELECT e.council_id FROM event_files f
       JOIN events e ON f.event_id = e.event_id
       WHERE f.file_id = ?`,
      [fileId]
    );

    if (rows.length === 0) return next();

    if (rows[0].council_id !== req.user.council_id) {
      return next(require("../utils/HttpError").notFound("File not found"));
    }

    next();
  };
}

/**
 * Verifies that a certificate belongs to the council lead's council.
 * Super admin bypasses.
 */
export function requireCouncilCertAccess(certIdParam = "id") {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) return next(unauthorized());
    if (req.user.role === "super_admin") return next();
    if (req.user.role === "member" || req.user.role === "council_member") {
      return next(forbidden());
    }

    const certId = Number(req.params[certIdParam]);
    if (!certId) return next();

    const rows = await query<any[]>(
      `SELECT e.council_id FROM certificates c
       JOIN events e ON c.event_id = e.event_id
       WHERE c.certificate_id = ?`,
      [certId]
    );

    if (rows.length === 0) return next();

    if (rows[0].council_id !== req.user.council_id) {
      return next(require("../utils/HttpError").notFound("Certificate not found"));
    }

    next();
  };
}
