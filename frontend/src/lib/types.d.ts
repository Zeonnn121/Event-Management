export type User = {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'organizer' | 'member';
    department?: string;
};
export type Event = {
    id: number;
    title: string;
    description?: string;
    category: string;
    event_date: string;
    start_time: string;
    end_time: string;
    venue: string;
    coordinator_id?: number;
    capacity: number;
    registration_deadline?: string;
    status: 'planned' | 'registration_open' | 'ongoing' | 'completed' | 'cancelled';
    organizers?: User[];
    registration_count?: number;
    file_count?: number;
    outcome?: Outcome | null;
};
export type Outcome = {
    id: number;
    event_id: number;
    participants_count?: number;
    feedback_score?: number;
    winners?: string;
    description?: string;
};
export type Participant = {
    id: number;
    name: string;
    email: string;
    department: string;
    year: number;
    phone?: string;
    participation_history?: Registration[];
};
export type Registration = {
    id: number;
    event_id: number;
    participant_id: number;
    status: 'registered' | 'waitlisted' | 'cancelled';
    registered_date: string;
    present?: boolean;
};
export type Certificate = {
    id: number;
    event_id: number;
    participant_id: number;
    status: 'pending' | 'issued';
    created_at: string;
    issued_at?: string;
};
export type FileRecord = {
    id: number;
    event_id: number;
    file_name: string;
    s3_key: string;
    file_type: 'photo' | 'report' | 'poster' | 'document';
    content_type: string;
    size_bytes: number;
    uploaded_by_name: string;
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
export type DashboardStats = {
    total_events: number;
    upcoming_events: number;
    completed_events: number;
    total_participants: number;
    total_registrations: number;
    certificates_issued: number;
    events_by_category: Array<{
        category: string;
        count: number;
    }>;
    events_by_year: Array<{
        year: number;
        count: number;
    }>;
    top_events: Event[];
    recent_uploads: FileRecord[];
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
    skipped: Array<{
        participant_id: number;
        reason: string;
    }>;
};
export type AttendanceRecord = {
    participant_id: number;
    present: boolean;
};
export type AttendanceResponse = {
    data: AttendanceRecord[];
    summary: {
        registered: number;
        present: number;
        absent: number;
    };
};
