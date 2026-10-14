export type Role = 'super_admin' | 'council_lead' | 'council_member' | 'member';

/// Only these two can be chosen during self-registration; council members are
/// added by the Council Lead of their council.
export type RequestableRole = 'member' | 'council_lead';

export type User = {
  user_id: number;
  name: string;
  email: string;
  role: Role;
  department?: string | null;
  council_id?: number | null;
  council_name?: string | null;
  council_slug?: string | null;
  is_active?: boolean;
  created_at?: string;
};

export type Council = {
  council_id: number;
  name: string;
  slug: string;
  description?: string | null;
  is_active: boolean;
  lead_user_id?: number | null;
  lead_name?: string | null;
  lead_email?: string | null;
  event_count?: number;
  member_count?: number;
};

/// A pending/approved/rejected self-registration by someone asking to lead a council.
export type RegistrationRequest = {
  request_id: number;
  name: string;
  email: string;
  requested_role: RequestableRole;
  council_name: string;
  council_slug: string;
  department?: string | null;
  message?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  reviewed_at?: string | null;
  review_note?: string | null;
  reviewed_by_name?: string | null;
};

export type Organizer = {
  organizer_id: number;
  event_id?: number;
  user_id: number;
  user_name: string;
  email?: string;
  responsibility: string;
};

export type EventStatus = 'planned' | 'registration_open' | 'ongoing' | 'completed' | 'cancelled';

// NOTE: the API keys every row by its table's primary-key name (`event_id`,
// `participant_id`, ...), not by a generic `id`. Keep these in sync with the
// SELECT lists in backend/src/routes/*.
export type Event = {
  event_id: number;
  title: string;
  description?: string | null;
  category: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  coordinator_id?: number | null;
  coordinator_name?: string | null;
  capacity: number;
  registration_deadline?: string | null;
  status: EventStatus;
  council_id?: number | null;
  council_name?: string | null;
  organizers?: Organizer[];
  registration_count?: number;
  file_count?: number;
  outcome?: Outcome | null;
};

export type Outcome = {
  outcome_id: number;
  event_id: number;
  participants_count?: number;
  feedback_score?: number | null;
  winners?: string | null;
  description?: string | null;
};

export type Participant = {
  participant_id: number;
  name: string;
  email: string;
  department: string;
  year: number;
  phone?: string | null;
  created_at?: string;
  participation_history?: ParticipationHistory[];
};

/// One row of a participant's history: their registration joined with the event,
/// attendance and certificate (GET /api/participants/:id).
export type ParticipationHistory = {
  event_id: number;
  title: string;
  event_date: string;
  category: string;
  event_status: EventStatus;
  registration_id: number;
  registration_status: string;
  registration_date: string;
  present: boolean | number | null;
  certificate_id: number | null;
  certificate_code: string | null;
  certificate_status: string | null;
};

/// A registration row for an event, including the participant's details
/// (GET /api/events/:id/registrations).
export type Registration = {
  registration_id: number;
  event_id: number;
  participant_id: number;
  registration_date: string;
  status: 'registered' | 'waitlisted' | 'cancelled';
  name: string;
  email: string;
  department: string;
  year: number;
};

export type Certificate = {
  certificate_id: number;
  certificate_code: string;
  event_id: number;
  participant_id: number;
  status: 'pending' | 'issued';
  s3_key?: string | null;
  issued_date: string | null;
  name?: string;
  email?: string;
  department?: string;
  year?: number;
};

export type FileRecord = {
  file_id: number;
  event_id: number;
  original_name: string;
  s3_key: string;
  file_type: 'photo' | 'report' | 'poster' | 'document';
  content_type: string;
  size_bytes: number;
  uploaded_by?: number | null;
  uploaded_by_name?: string | null;
  uploaded_at: string;
};

export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

export type ApiResponse<T> = {
  data: T;
  page?: number;
  limit?: number;
  total?: number;
  summary?: Record<string, unknown>;
};

/// A row of GET /api/dashboard/stats `top_events` — a slimmer shape than Event.
export type DashboardTopEvent = {
  event_id: number;
  title: string;
  category: string;
  event_date: string;
  status: EventStatus;
  council_name?: string | null;
  participants_count: number;
};

/// A row of GET /api/dashboard/stats `recent_uploads` — a slimmer shape than
/// FileRecord (it carries the event title instead of the S3 metadata).
export type DashboardUpload = {
  file_id: number;
  event_id: number;
  original_name: string;
  file_type: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
  event_title: string;
};

export type DashboardStats = {
  total_events: number;
  upcoming_events: number;
  completed_events: number;
  total_participants: number;
  total_registrations: number;
  certificates_issued: number;
  events_by_category: Array<{ category: string; count: number }>;
  events_by_year: Array<{ year: number; count: number }>;
  top_events: DashboardTopEvent[];
  recent_uploads: DashboardUpload[];
  // Super admin only
  total_councils?: number;
  active_leads?: number;
  council_breakdown?: Array<{
    council_id: number;
    council_name: string;
    slug: string;
    event_count: number;
    completed_events: number;
    upcoming_events: number;
    lead_name?: string | null;
    lead_email?: string | null;
  }>;
};

export type UploadUrlResponse = {
  upload_url: string;
  s3_key: string;
};

export type DownloadUrlResponse = {
  url: string;
};

export type CreateCertificatesResponse = {
  created: Certificate[];
  skipped: Array<{ participant_id: number; reason: string }>;
};

export type AttendanceRecord = {
  participant_id: number;
  name: string;
  email: string;
  department: string;
  year: number;
  present: boolean | number;
  marked_at?: string;
};

export type AttendanceResponse = {
  data: AttendanceRecord[];
  summary: {
    registered: number;
    present: number;
    absent: number;
  };
};
