import { Router, Request, Response } from "express";
import { z } from "zod";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { query } from "../db";
import { badRequest, notFound, forbidden } from "../utils/HttpError";
import { asyncHandler } from "../middleware/asyncHandler";
import { validate } from "../middleware/validate";
import { requireAuth, requireRole, requireCouncilEventAccess, requireCouncilFileAccess } from "../middleware/auth";
import {
  buildEventKey,
  getUploadUrl,
  getDownloadUrl,
  deleteObject,
  headObject,
} from "../services/s3.service";

const router = Router();

// ── Allowed content-type matrix ──
const ALLOWED_TYPES: Record<string, string[]> = {
  photo: ["image/jpeg", "image/png", "image/webp"],
  report: ["application/pdf"],
  poster: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  document: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const uploadUrlSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_type: z.enum(["photo", "report", "poster", "document"]),
  content_type: z.string().min(1),
  size_bytes: z.number().int().positive().max(MAX_SIZE_BYTES, {
    message: "File size must not exceed 10 MB",
  }),
});

const registerFileSchema = z.object({
  s3_key: z.string().min(1),
  original_name: z.string().min(1).max(255),
  file_type: z.enum(["photo", "report", "poster", "document"]),
  content_type: z.string().min(1),
  size_bytes: z.number().int().positive(),
});

// ── Helper: verify event belongs to the caller's council ──
async function verifyEventAccess(eventId: number, user: Express.Request["user"]): Promise<void> {
  if (!user) throw forbidden();
  if (user.role === "super_admin") return;

  const rows = await query<RowDataPacket[]>(
    "SELECT council_id FROM events WHERE event_id = ?",
    [eventId]
  );
  if (rows.length === 0) throw notFound("Event not found");

  if (rows[0].council_id !== user.council_id) {
    throw notFound("Event not found");
  }
}

// ── POST /api/events/:id/files/upload-url (super_admin or council_lead) ──
router.post(
  "/events/:id/files/upload-url",
  requireAuth,
  requireRole("super_admin", "council_lead"),
  validate(uploadUrlSchema, "body"),
  asyncHandler(async (req: Request, res: Response) => {
    const eventId = Number(req.params.id);
    if (!eventId) throw badRequest("Invalid event ID");

    await verifyEventAccess(eventId, req.user);

    const { file_name, file_type, content_type, size_bytes } = req.body as z.infer<typeof uploadUrlSchema>;

    const eventRows = await query<RowDataPacket[]>(
      "SELECT event_id FROM events WHERE event_id = ?",
      [eventId]
    );
    if (eventRows.length === 0) throw notFound("Event not found");

    const allowed = ALLOWED_TYPES[file_type];
    if (!allowed.includes(content_type)) {
      throw badRequest(
        `Content type '${content_type}' is not allowed for file type '${file_type}'. Allowed: ${allowed.join(", ")}`
      );
    }

    const s3Key = buildEventKey(eventId, file_type, file_name);
    const uploadUrl = await getUploadUrl({ key: s3Key, contentType: content_type });

    res.json({ data: { upload_url: uploadUrl, s3_key: s3Key } });
  })
);

// ── POST /api/events/:id/files (super_admin or council_lead) ──
router.post(
  "/events/:id/files",
  requireAuth,
  requireRole("super_admin", "council_lead"),
  validate(registerFileSchema, "body"),
  asyncHandler(async (req: Request, res: Response) => {
    const eventId = Number(req.params.id);
    if (!eventId) throw badRequest("Invalid event ID");

    await verifyEventAccess(eventId, req.user);

    const { s3_key, original_name, file_type, content_type, size_bytes } = req.body as z.infer<typeof registerFileSchema>;

    const eventRows = await query<RowDataPacket[]>(
      "SELECT event_id FROM events WHERE event_id = ?",
      [eventId]
    );
    if (eventRows.length === 0) throw notFound("Event not found");

    const expectedPrefix = `events/event-${eventId}/`;
    if (!s3_key.startsWith(expectedPrefix)) {
      throw forbidden(`s3_key must start with '${expectedPrefix}'`);
    }

    const exists = await headObject(s3_key);
    if (!exists) {
      throw badRequest("The specified S3 object does not exist. Upload the file first.");
    }

    const uploadedBy = req.user?.user_id ?? null;

    const result = await query<ResultSetHeader>(
      `INSERT INTO event_files (event_id, s3_key, original_name, file_type, content_type, size_bytes, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [eventId, s3_key, original_name, file_type, content_type, size_bytes, uploadedBy]
    );

    const created = await query<RowDataPacket[]>(
      "SELECT * FROM event_files WHERE file_id = ?",
      [result.insertId]
    );

    res.status(201).json({ data: created[0] });
  })
);

// ── GET /api/events/:id/files ──
router.get(
  "/events/:id/files",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const eventId = Number(req.params.id);
    if (!eventId) throw badRequest("Invalid event ID");

    await verifyEventAccess(eventId, req.user);

    const eventRows = await query<RowDataPacket[]>(
      "SELECT event_id FROM events WHERE event_id = ?",
      [eventId]
    );
    if (eventRows.length === 0) throw notFound("Event not found");

    const params: (number | string)[] = [eventId];
    let fileTypeClause = "";

    if (req.query.file_type && typeof req.query.file_type === "string") {
      const validTypes = ["photo", "report", "poster", "document"];
      if (!validTypes.includes(req.query.file_type)) {
        throw badRequest(`file_type must be one of: ${validTypes.join(", ")}`);
      }
      fileTypeClause = "AND f.file_type = ?";
      params.push(req.query.file_type);
    }

    const rows = await query<RowDataPacket[]>(
      `SELECT
         f.file_id, f.event_id, f.s3_key, f.original_name,
         f.file_type, f.content_type, f.size_bytes,
         f.uploaded_by, f.uploaded_at,
         u.name AS uploaded_by_name
       FROM event_files f
       LEFT JOIN users u ON f.uploaded_by = u.user_id
       WHERE f.event_id = ? ${fileTypeClause}
       ORDER BY f.uploaded_at DESC`,
      params
    );

    res.json({ data: rows });
  })
);

// ── GET /api/files/:fileId/download-url ──
router.get(
  "/files/:fileId/download-url",
  requireAuth,
  requireCouncilFileAccess("fileId"),
  asyncHandler(async (req: Request, res: Response) => {
    const fileId = Number(req.params.fileId);
    if (!fileId) throw badRequest("Invalid file ID");

    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM event_files WHERE file_id = ?",
      [fileId]
    );
    if (rows.length === 0) throw notFound("File not found");

    const url = await getDownloadUrl(rows[0].s3_key as string);

    res.json({ data: { url } });
  })
);

// ── DELETE /api/files/:fileId (super_admin or council_lead) ──
router.delete(
  "/files/:fileId",
  requireAuth,
  requireRole("super_admin", "council_lead"),
  requireCouncilFileAccess("fileId"),
  asyncHandler(async (req: Request, res: Response) => {
    const fileId = Number(req.params.fileId);
    if (!fileId) throw badRequest("Invalid file ID");

    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM event_files WHERE file_id = ?",
      [fileId]
    );
    if (rows.length === 0) throw notFound("File not found");

    const s3Key = rows[0].s3_key as string;

    await query("DELETE FROM event_files WHERE file_id = ?", [fileId]);
    await deleteObject(s3Key);

    res.json({ data: { message: "File deleted successfully" } });
  })
);

export default router;
