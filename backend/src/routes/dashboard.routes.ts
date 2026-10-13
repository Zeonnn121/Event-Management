import { Router, Request, Response } from "express";
import { RowDataPacket } from "mysql2/promise";
import { query } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";

const router = Router();

// ── GET /api/dashboard/stats ──
// Super admin: platform-wide stats.
// Council lead: stats scoped to their council.
router.get(
  "/stats",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const isSuperAdmin = req.user?.role === "super_admin";
    const councilId = req.user?.council_id ?? null;

    // Council filter for SQL
    const cf = isSuperAdmin ? "" : "AND e.council_id = ?";
    const cfParam = isSuperAdmin ? [] : [councilId];
    const cfWhere = isSuperAdmin ? "" : "WHERE e.council_id = ?";

    const [
      totalEvents,
      upcomingEvents,
      ongoingEvents,
      completedEvents,
      cancelledEvents,
      totalParticipants,
      totalRegistrations,
      certificatesIssued,
      eventsByCategory,
      eventsByYear,
      topEvents,
      recentUploads,
      totalCouncils,
      activeLeads,
    ] = await Promise.all([
      query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM events e WHERE 1=1 ${cf}`,
        cfParam
      ),
      query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM events e WHERE event_date >= CURDATE() AND status IN ('planned','registration_open') ${cf}`,
        cfParam
      ),
      query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM events e WHERE status = 'ongoing' ${cf}`,
        cfParam
      ),
      query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM events e WHERE status = 'completed' ${cf}`,
        cfParam
      ),
      query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM events e WHERE status = 'cancelled' ${cf}`,
        cfParam
      ),
      // total_participants: distinct participants in registrations for scoped events
      query<RowDataPacket[]>(
        isSuperAdmin
          ? `SELECT COUNT(DISTINCT r.participant_id) AS count FROM registrations r`
          : `SELECT COUNT(DISTINCT r.participant_id) AS count FROM registrations r JOIN events e ON r.event_id = e.event_id WHERE e.council_id = ?`,
        isSuperAdmin ? [] : [councilId]
      ),
      query<RowDataPacket[]>(
        isSuperAdmin
          ? `SELECT COUNT(*) AS count FROM registrations WHERE status = 'registered'`
          : `SELECT COUNT(*) AS count FROM registrations r JOIN events e ON r.event_id = e.event_id WHERE r.status = 'registered' AND e.council_id = ?`,
        isSuperAdmin ? [] : [councilId]
      ),
      query<RowDataPacket[]>(
        isSuperAdmin
          ? `SELECT COUNT(*) AS count FROM certificates WHERE status = 'issued'`
          : `SELECT COUNT(*) AS count FROM certificates c JOIN events e ON c.event_id = e.event_id WHERE c.status = 'issued' AND e.council_id = ?`,
        isSuperAdmin ? [] : [councilId]
      ),
      query<RowDataPacket[]>(
        `SELECT e.category, COUNT(*) AS count
         FROM events e
         WHERE 1=1 ${cf}
         GROUP BY e.category
         ORDER BY count DESC, e.category ASC`,
        cfParam
      ),
      query<RowDataPacket[]>(
        `SELECT YEAR(e.event_date) AS year, COUNT(*) AS count
         FROM events e
         WHERE 1=1 ${cf}
         GROUP BY year
         ORDER BY year ASC`,
        cfParam
      ),
      query<RowDataPacket[]>(
        `SELECT
           e.event_id, e.title, e.category, e.event_date, e.status,
           coun.name AS council_name,
           COALESCE(
             o.participants_count,
             (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.event_id AND r.status = 'registered')
           ) AS participants_count
         FROM events e
         LEFT JOIN outcomes o ON o.event_id = e.event_id
         LEFT JOIN councils coun ON e.council_id = coun.council_id
         WHERE 1=1 ${cf}
         ORDER BY participants_count DESC, e.event_date DESC
         LIMIT 5`,
        cfParam
      ),
      query<RowDataPacket[]>(
        isSuperAdmin
          ? `SELECT
               f.file_id, f.event_id, f.original_name, f.file_type,
               f.content_type, f.size_bytes, f.uploaded_at,
               e.title AS event_title
             FROM event_files f
             JOIN events e ON f.event_id = e.event_id
             ORDER BY f.uploaded_at DESC, f.file_id DESC
             LIMIT 5`
          : `SELECT
               f.file_id, f.event_id, f.original_name, f.file_type,
               f.content_type, f.size_bytes, f.uploaded_at,
               e.title AS event_title
             FROM event_files f
             JOIN events e ON f.event_id = e.event_id
             WHERE e.council_id = ?
             ORDER BY f.uploaded_at DESC, f.file_id DESC
             LIMIT 5`,
        isSuperAdmin ? [] : [councilId]
      ),
      // Super admin extras
      isSuperAdmin
        ? query<RowDataPacket[]>("SELECT COUNT(*) AS count FROM councils")
        : Promise.resolve([{ count: 0 }] as RowDataPacket[]),
      isSuperAdmin
        ? query<RowDataPacket[]>(
            "SELECT COUNT(*) AS count FROM users WHERE role = 'council_lead' AND is_active = TRUE"
          )
        : Promise.resolve([{ count: 0 }] as RowDataPacket[]),
    ]);

    const responseData: Record<string, unknown> = {
      total_events: Number(totalEvents[0].count),
      upcoming_events: Number(upcomingEvents[0].count),
      ongoing_events: Number(ongoingEvents[0].count),
      completed_events: Number(completedEvents[0].count),
      cancelled_events: Number(cancelledEvents[0].count),
      total_participants: Number(totalParticipants[0].count),
      total_registrations: Number(totalRegistrations[0].count),
      certificates_issued: Number(certificatesIssued[0].count),
      events_by_category: eventsByCategory,
      events_by_year: eventsByYear,
      top_events: topEvents,
      recent_uploads: recentUploads,
    };

    if (isSuperAdmin) {
      // Add per-council breakdown
      const councilBreakdown = await query<RowDataPacket[]>(
        `SELECT
           c.council_id, c.name AS council_name, c.slug,
           COUNT(e.event_id) AS event_count,
           COALESCE(SUM(CASE WHEN e.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed_events,
           COALESCE(SUM(CASE WHEN e.status IN ('planned','registration_open') AND e.event_date >= CURDATE() THEN 1 ELSE 0 END), 0) AS upcoming_events,
           u.name AS lead_name, u.email AS lead_email
         FROM councils c
         LEFT JOIN events e ON e.council_id = c.council_id
         LEFT JOIN users u ON u.council_id = c.council_id AND u.role = 'council_lead' AND u.is_active = TRUE
         GROUP BY c.council_id, c.name, c.slug, u.name, u.email
         ORDER BY event_count DESC`
      );

      responseData.total_councils = Number(totalCouncils[0].count);
      responseData.active_leads = Number(activeLeads[0].count);
      responseData.council_breakdown = councilBreakdown;
    }

    res.json({ data: responseData });
  })
);

export default router;
