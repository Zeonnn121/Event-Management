import { Router, Request, Response } from "express";
import { z } from "zod";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { query } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

// ── GET /api/profile ──
// Returns the current user's participant profile (if it exists) combined with
// user account info. Used by the My Info page for members.
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;

    const rows = await query<RowDataPacket[]>(
      "SELECT participant_id, name, email, department, year, phone, gender FROM participants WHERE email = ?",
      [user.email]
    );

    if (rows.length === 0) {
      // Return a stub so the form can pre-fill name/email from auth
      res.json({
        data: {
          participant_id: null,
          name: user.name,
          email: user.email,
          department: null,
          year: null,
          phone: null,
          gender: null,
        },
      });
      return;
    }

    res.json({ data: rows[0] });
  })
);

// ── PUT /api/profile ──
// Upserts the participant row for the logged-in user and syncs their name
// back to the users table.
const profileSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().max(20).optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  year: z.number().int().min(1).max(4),
  department: z.string().min(1).max(100),
});

router.put(
  "/",
  validate(profileSchema, "body"),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const { name, phone, gender, year, department } = req.body as z.infer<typeof profileSchema>;

    // Sync name back to users table
    await query("UPDATE users SET name = ? WHERE user_id = ?", [name, user.user_id]);

    // Upsert participant row
    const existing = await query<RowDataPacket[]>(
      "SELECT participant_id FROM participants WHERE email = ?",
      [user.email]
    );

    if (existing.length > 0) {
      await query(
        "UPDATE participants SET name = ?, department = ?, year = ?, phone = ?, gender = ? WHERE email = ?",
        [name, department, year, phone ?? null, gender ?? null, user.email]
      );
    } else {
      await query<ResultSetHeader>(
        "INSERT INTO participants (name, email, department, year, phone, gender) VALUES (?, ?, ?, ?, ?, ?)",
        [name, user.email, department, year, phone ?? null, gender ?? null]
      );
    }

    const updated = await query<RowDataPacket[]>(
      "SELECT participant_id, name, email, department, year, phone, gender FROM participants WHERE email = ?",
      [user.email]
    );

    res.json({ data: updated[0] });
  })
);

export default router;
