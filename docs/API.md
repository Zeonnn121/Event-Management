# Technical Council API Reference

## Conventions

- **Base URL**: `http://localhost:4000/api` (dev) — set via `PORT` env var
- **Authentication**: JWT Bearer token — `Authorization: Bearer <token>`
- **Response envelope**: All successful responses use `{ "data": ... }`
- **Error envelope**: `{ "error": { "message": "...", "details": [...] } }`
- **Field naming**: snake_case throughout
- **Dates**: ISO 8601 strings (`YYYY-MM-DD` for dates, `YYYY-MM-DDTHH:mm:ss.sssZ` for timestamps)
- **Pagination**: `page` (default 1) and `limit` (default 20) query params; response includes `page`, `limit`, `total`

### HTTP status codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | No Content (delete/update with no body) |
| 400 | Validation error |
| 401 | Missing or invalid token |
| 403 | Authenticated but insufficient role |
| 404 | Resource not found |
| 409 | Conflict (duplicate, capacity full, invalid state) |
| 500 | Internal server error |

### Role hierarchy

`super_admin` > `council_lead` > `council_member` > `member`

| Role | Rights |
| --- | --- |
| `super_admin` | Everything. The only role that can delete a council. |
| `council_lead` | Manages one council: creates and deletes its events, adds and removes its council members. |
| `council_member` | Added to a council by that council's lead. Read-only, platform-wide view. |
| `member` | Self-registered with no council. Read-only, platform-wide view. |

A `council_lead` is scoped to a single council: the events and the user list it
can see are limited to its own council. `council_member` and `member` are
read-only observers with the same platform-wide visibility — they are refused by
management endpoints.

---

## Auth

### POST /api/auth/login

Rate limited: 10 attempts per minute per IP.

**Request body**
```json
{ "email": "admin@council.edu", "password": "Admin@123" }
```

**Success** `200`
```json
{
  "data": {
    "token": "<JWT>",
    "user": {
      "user_id": 1,
      "name": "Alice Admin",
      "email": "admin@council.edu",
      "role": "admin",
      "department": "Computer Science"
    }
  }
}
```

**Errors**
- `401` — invalid credentials
- `429` — rate limit exceeded

---

### GET /api/auth/me

Requires: any authenticated user.

**Success** `200`
```json
{
  "data": {
    "user_id": 1,
    "name": "Alice Admin",
    "email": "admin@council.edu",
    "role": "admin",
    "department": "Computer Science"
  }
}
```

---

### POST /api/auth/register

Public — no token required. Rate limited: 10 attempts per minute per IP.

Self-registration. `role` decides what happens:

- `member` — the account is created active immediately and a session token is
  returned, exactly like login.
- `council_lead` — the request is stored as `pending` and a super admin must
  approve it (see [Registration Requests](#registration-requests)). No token is
  returned, and the email cannot sign in until it is approved.

**Request body**
```json
{
  "name": "Ada Lead",
  "email": "ada@council.edu",
  "password": "Leader@123",
  "role": "council_lead",
  "council_name": "Coding Council",
  "department": "CSE",
  "message": "We will run weekly hack nights."
}
```

Fields: `name` (2–100 chars), `email`, `password` (min 8 chars), `role`
(`member` | `council_lead`), `department` (optional), `council_name` (required
when `role` is `council_lead` — this is the council created on approval),
`message` (optional, shown to the super admin).

**Success — member** `201`
```json
{
  "data": {
    "token": "eyJhbGciOi...",
    "user": {
      "user_id": 8,
      "name": "Fresh Member",
      "email": "fresh@council.edu",
      "role": "member",
      "council_id": null,
      "is_active": true
    }
  }
}
```

**Success — council lead (queued)** `201`
```json
{
  "data": {
    "pending": true,
    "message": "Your Council Lead request has been submitted. You can sign in once a Super Admin approves it."
  }
}
```

**Errors**
- `400` — validation failed (for example `council_lead` without `council_name`)
- `409` — email already registered, or a pending request already exists

---

## Users

### POST /api/users

Requires: `super_admin`, or `council_lead`. A council lead may only create
`council_member` users, and the account is always placed in the lead's own
council — any `role` or `council_id` they send is ignored.

**Request body**
```json
{
  "name": "Bob Organizer",
  "email": "bob@council.edu",
  "password": "Organizer@123",
  "role": "organizer",
  "department": "Electrical Engineering"
}
```

Fields: `name` (1–100 chars), `email` (valid email), `password` (min 8 chars), `role` (`super_admin` | `council_lead` | `council_member` | `member`), `department` (optional, max 100 chars), `council_id` (optional; required in practice for `council_lead` and `council_member`).

**Success** `201`
```json
{
  "data": {
    "user_id": 2,
    "name": "Bob Organizer",
    "email": "bob@council.edu",
    "role": "member",
    "council_id": 1,
    "council_name": "Coding Council",
    "department": "Electrical Engineering",
    "created_at": "2025-09-15T10:00:00.000Z"
  }
}
```

**Errors**
- `409` — email already exists, or the target council already has an active lead

---

### GET /api/users

Requires: `super_admin` or `council_lead`. A council lead only ever receives
users in their own council, and the `council_id` filter is ignored for them.

**Query params**
| Param | Type | Description |
|---|---|---|
| `role` | string | Filter by role (`super_admin`, `council_lead`, `council_member`, `member`) — super admin only |
| `council_id` | number | Filter by council — super admin only |

**Success** `200`
```json
{
  "data": [
    {
      "user_id": 1,
      "name": "Alice Admin",
      "email": "admin@council.edu",
      "role": "super_admin",
      "department": "Computer Science",
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### DELETE /api/users/:id/council

Requires: `super_admin`, or `council_lead` for their own council.

Removes someone from their council but **keeps their account**: they are
detached and become a plain `member`, so this is reversible by re-adding them.
This is the supported way to empty a council, because
`DELETE /api/councils/:id` is refused while anyone still belongs to it.

A council lead may only detach `council_member` users in their own council;
anyone else is `403`, and users from another council are `404`.

**Success** `200`
```json
{
  "data": {
    "user_id": 14,
    "name": "Raj yadav",
    "role": "member",
    "council_id": null,
    "message": "Removed from council"
  }
}
```

**Errors**
- `400` — the user is not in a council
- `403` — a lead tried to remove a lead, or a read-only role tried to remove anyone
- `404` — user not found, or belongs to another council

---

## Councils

| Method | Endpoint | Requires | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/councils` | any authenticated user | List councils with lead, `event_count` and `member_count` |
| `GET` | `/api/councils/:id` | any authenticated user | One council (a lead is limited to its own) |
| `POST` | `/api/councils` | `super_admin` | Create a council |
| `PUT` | `/api/councils/:id` | `super_admin` | Update name / slug / description |
| `PATCH` | `/api/councils/:id/status` | `super_admin` | Activate or deactivate |
| `POST` | `/api/councils/:id/assign-lead` | `super_admin` | Attach an existing `council_lead` to the council |
| `DELETE` | `/api/councils/:id` | `super_admin` | Delete a council |

### DELETE /api/councils/:id

Refuses to delete a council that still has events or people in it, so nothing is
silently orphaned. Empty it first: detach its members with
`DELETE /api/users/:id/council` and delete its events.

**Success** `204` — no body

**Errors**
- `403` — not a super admin
- `404` — council not found
- `409` — council not empty
```json
{
  "error": {
    "message": "\"Coding Council\" is not empty: it still has 3 event(s) and 2 member(s). Remove its members and delete its events first.",
    "details": { "event_count": 3, "user_count": 2 }
  }
}
```

---

## Registration Requests

The approval queue for people who registered as a Council Lead. Every endpoint
requires `super_admin`.

### GET /api/registration-requests

**Query params**
| Param | Type | Description |
|---|---|---|
| `status` | string | `pending` (default), `approved`, `rejected`, or `all` |

**Success** `200`
```json
{
  "data": [
    {
      "request_id": 1,
      "name": "Ada Lead",
      "email": "ada@council.edu",
      "requested_role": "council_lead",
      "council_name": "Coding Council",
      "council_slug": "coding-council",
      "department": "CSE",
      "message": "We will run weekly hack nights.",
      "status": "pending",
      "requested_at": "2025-09-15T10:00:00.000Z",
      "reviewed_at": null,
      "review_note": null,
      "reviewed_by_name": null
    }
  ]
}
```

---

### POST /api/registration-requests/:id/approve

Creates the proposed council and the Council Lead account, then marks the request
approved — all in one transaction.

**Request body** (optional)
```json
{
  "council_name": "Coding Council",
  "council_slug": "coding-council"
}
```

Both fields are optional overrides: omit them to use what the requester
proposed. The slug is auto-suffixed (`coding-council-2`, …) when already taken.

**Success** `200`
```json
{
  "data": {
    "request_id": 1,
    "status": "approved",
    "council_id": 6,
    "council_name": "Coding Council",
    "council_slug": "coding-council"
  }
}
```

**Errors**
- `404` — request not found
- `409` — request already approved/rejected, or the email now belongs to a user

---

### POST /api/registration-requests/:id/reject

**Request body** (optional)
```json
{ "reason": "Please reapply next semester" }
```

**Success** `200`
```json
{ "data": { "request_id": 1, "status": "rejected" } }
```

---

## Events

### GET /api/events/meta/filters

Requires: any authenticated user. Returns distinct values for filter dropdowns.

**Success** `200`
```json
{
  "data": {
    "categories": ["workshop", "seminar", "competition", "cultural"],
    "years": [2024, 2025],
    "departments": ["Computer Science", "Electrical Engineering"]
  }
}
```

---

### GET /api/events

Requires: any authenticated user. Paginated list with optional filters.

**Query params**
| Param | Type | Description |
|---|---|---|
| `q` | string | Search title or description |
| `year` | number | Filter by event year |
| `category` | string | Filter by category |
| `status` | string | Filter by status (`planned`, `registration_open`, `ongoing`, `completed`, `cancelled`) |
| `department` | string | Filter by department |
| `organizer` | number | Filter by organizer user_id |
| `min_participants` | number | Min outcome participants count |
| `from` | date | Event date on or after (YYYY-MM-DD) |
| `to` | date | Event date on or before (YYYY-MM-DD) |
| `sort` | string | `date_asc`, `date_desc` (default), `title_asc`, `title_desc` |
| `page` | number | Page number (default 1) |
| `limit` | number | Items per page (default 20) |

**Success** `200`
```json
{
  "data": [
    {
      "event_id": 1,
      "title": "Annual Tech Symposium",
      "description": "...",
      "category": "seminar",
      "event_date": "2025-10-15",
      "venue": "Main Auditorium",
      "max_participants": 200,
      "registration_deadline": "2025-10-10",
      "status": "registration_open",
      "department": "Computer Science",
      "created_by": 1,
      "coordinator_name": "Alice Admin",
      "registration_count": 45,
      "outcome_participants": null,
      "created_at": "2025-09-01T00:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1
}
```

---

### GET /api/events/:id

Requires: any authenticated user. Returns full event detail including organizers and outcome.

**Success** `200`
```json
{
  "data": {
    "event_id": 1,
    "title": "Annual Tech Symposium",
    "description": "...",
    "category": "seminar",
    "event_date": "2025-10-15",
    "venue": "Main Auditorium",
    "max_participants": 200,
    "registration_deadline": "2025-10-10",
    "status": "completed",
    "department": "Computer Science",
    "created_by": 1,
    "created_at": "2025-09-01T00:00:00.000Z",
    "organizers": [
      { "user_id": 2, "name": "Bob Organizer", "email": "bob@council.edu", "responsibility": "Logistics" }
    ],
    "registration_count": 150,
    "file_count": 8,
    "outcome": {
      "outcome_id": 1,
      "participants_count": 148,
      "feedback_score": 4.5,
      "winners": "Team Alpha",
      "description": "Highly successful event.",
      "created_at": "2025-10-16T00:00:00.000Z"
    }
  }
}
```

**Errors**
- `404` — event not found

---

### POST /api/events

Requires: `admin` or `organizer`.

**Request body**
```json
{
  "title": "Annual Tech Symposium",
  "description": "A flagship annual event.",
  "category": "seminar",
  "event_date": "2025-10-15",
  "venue": "Main Auditorium",
  "max_participants": 200,
  "registration_deadline": "2025-10-10",
  "department": "Computer Science"
}
```

All date fields: `YYYY-MM-DD`.

**Success** `201` — created event object (same shape as GET /api/events/:id without outcome)

**Errors**
- `409` — scheduling conflict (another event at the same venue on the same date); response includes conflicting event details

---

### PUT /api/events/:id

Requires: `admin` or `organizer`. Partial update — only send fields to change.

**Request body** — any subset of event fields (same as POST)

**Success** `200` — updated event object

**Errors**
- `404` — event not found
- `409` — scheduling conflict (excluding this event itself)

---

### PATCH /api/events/:id/status

Requires: `admin` or `organizer`.

**Request body**
```json
{ "status": "registration_open" }
```

**Allowed transitions**
```
planned → registration_open → ongoing → completed
any non-terminal → cancelled
```
Terminal states (`completed`, `cancelled`) are locked.

**Success** `200` — updated event object

**Errors**
- `409` — invalid transition or terminal state locked

---

### DELETE /api/events/:id

Requires: `super_admin`, or `council_lead` for events in their own council.
Another council's event returns `404` rather than `403`, so its existence is not
leaked. Deleting an event also removes its registrations, attendance records,
files and certificates (`ON DELETE CASCADE`).

**Success** `204` — no body

**Errors**
- `403` — read-only role (`member` / `council_member`)
- `404` — event not found, or it belongs to another council

---

### GET /api/events/:id/organizers

Requires: any authenticated user.

**Success** `200`
```json
{
  "data": [
    { "user_id": 2, "name": "Bob Organizer", "email": "bob@council.edu", "responsibility": "Logistics" }
  ]
}
```

---

### POST /api/events/:id/organizers

Requires: `admin` or `organizer`.

**Request body**
```json
{ "user_id": 2, "responsibility": "Logistics" }
```

**Success** `201`
```json
{ "data": { "event_id": 1, "user_id": 2, "responsibility": "Logistics" } }
```

**Errors**
- `409` — user is already an organizer for this event

---

### DELETE /api/events/:id/organizers/:organizerId

Requires: `admin` or `organizer`.

**Success** `204` — no body

---

### PUT /api/events/:id/outcome

Requires: `admin` or `organizer`. Event must be in `completed` status. Upserts (creates or fully replaces) the outcome record.

**Request body**
```json
{
  "participants_count": 148,
  "feedback_score": 4.5,
  "winners": "Team Alpha",
  "description": "Highly successful event with great participation."
}
```

Fields: `participants_count` (optional, int), `feedback_score` (optional, float 0–5), `winners` (optional, string), `description` (optional, string). At least one field required.

**Success** `200`
```json
{
  "data": {
    "outcome_id": 1,
    "event_id": 1,
    "participants_count": 148,
    "feedback_score": 4.5,
    "winners": "Team Alpha",
    "description": "Highly successful event with great participation.",
    "created_at": "2025-10-16T00:00:00.000Z"
  }
}
```

**Errors**
- `409` — event is not in `completed` status

---

### GET /api/events/:id/outcome

Requires: any authenticated user.

**Success** `200` — same shape as PUT /api/events/:id/outcome response; `data` is `null` if no outcome recorded yet

---

## Participants

### GET /api/participants

Requires: any authenticated user. Paginated.

**Query params**
| Param | Type | Description |
|---|---|---|
| `q` | string | Search name or email |
| `department` | string | Filter by department |
| `year` | number | Filter by year of study |
| `page` | number | Page number (default 1) |
| `limit` | number | Items per page (default 20) |

**Success** `200`
```json
{
  "data": [
    {
      "participant_id": 1,
      "name": "Carol Student",
      "email": "carol@student.edu",
      "department": "Computer Science",
      "year": 2,
      "phone": "9876543210",
      "created_at": "2025-08-01T00:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1
}
```

---

### POST /api/participants

Requires: `admin` or `organizer`.

**Request body**
```json
{
  "name": "Carol Student",
  "email": "carol@student.edu",
  "department": "Computer Science",
  "year": 2,
  "phone": "9876543210"
}
```

**Success** `201` — created participant object

**Errors**
- `409` — email already registered as a participant

---

### GET /api/participants/:id

Requires: any authenticated user. Includes full participation history.

**Success** `200`
```json
{
  "data": {
    "participant_id": 1,
    "name": "Carol Student",
    "email": "carol@student.edu",
    "department": "Computer Science",
    "year": 2,
    "phone": "9876543210",
    "participation_history": [
      {
        "event_id": 1,
        "title": "Annual Tech Symposium",
        "event_date": "2025-10-15",
        "registration_status": "registered",
        "present": true,
        "certificate_status": "issued"
      }
    ]
  }
}
```

---

### PUT /api/participants/:id

Requires: `admin` or `organizer`. Partial update.

**Request body** — any subset of participant fields

**Success** `200` — updated participant object

**Errors**
- `404` — participant not found

---

## Registrations

### POST /api/events/:id/registrations

Requires: `admin` or `organizer`.

**Request body**
```json
{ "participant_id": 1 }
```

Checks: event must be in `planned` or `registration_open` status; registration deadline not passed; capacity — uses `SELECT ... FOR UPDATE` transaction to determine `registered` vs `waitlisted`.

**Success** `201`
```json
{
  "data": {
    "registration_id": 1,
    "event_id": 1,
    "participant_id": 1,
    "status": "registered",
    "registered_at": "2025-09-20T10:00:00.000Z"
  }
}
```

**Errors**
- `409` — duplicate registration, event not open for registration, or deadline passed

---

### GET /api/events/:id/registrations

Requires: any authenticated user.

**Success** `200`
```json
{
  "data": [
    {
      "registration_id": 1,
      "participant_id": 1,
      "name": "Carol Student",
      "email": "carol@student.edu",
      "department": "Computer Science",
      "year": 2,
      "status": "registered",
      "registered_at": "2025-09-20T10:00:00.000Z"
    }
  ]
}
```

---

### PATCH /api/registrations/:id

Requires: `admin` or `organizer`. Currently only supports cancellation.

**Request body**
```json
{ "status": "cancelled" }
```

If the cancelled registration had status `registered`, the oldest `waitlisted` participant is automatically promoted to `registered`.

**Success** `200` — updated registration object

---

### PUT /api/events/:id/attendance

Requires: `admin` or `organizer`. Bulk upsert attendance for an event.

**Request body**
```json
{
  "records": [
    { "participant_id": 1, "present": true },
    { "participant_id": 2, "present": false }
  ]
}
```

All `participant_id` values must be registered for this event. Uses `INSERT ... ON DUPLICATE KEY UPDATE` in a transaction.

**Success** `200`
```json
{ "data": { "updated": 2 } }
```

**Errors**
- `400` — one or more participant IDs are not registered for this event

---

### GET /api/events/:id/attendance

Requires: any authenticated user.

**Success** `200`
```json
{
  "data": {
    "records": [
      {
        "participant_id": 1,
        "name": "Carol Student",
        "email": "carol@student.edu",
        "department": "Computer Science",
        "present": true
      }
    ],
    "summary": {
      "registered": 150,
      "present": 148,
      "absent": 2
    }
  }
}
```

---

## Files

### POST /api/events/:id/files/upload-url

Requires: `admin` or `organizer`. Generates a presigned S3 PUT URL for direct browser upload.

**Request body**
```json
{
  "file_name": "banner.jpg",
  "file_type": "photo",
  "content_type": "image/jpeg",
  "size_bytes": 204800
}
```

`file_type` values: `photo`, `report`, `poster`, `document`. Validated against allowed `content_type` per type.

**Success** `200`
```json
{
  "data": {
    "upload_url": "https://s3.amazonaws.com/your-bucket/events/event-1/photos/uuid-banner.jpg?...",
    "s3_key": "events/event-1/photos/550e8400-e29b-41d4-a716-446655440000-banner.jpg"
  }
}
```

URL expires in 5 minutes.

---

### POST /api/events/:id/files

Requires: `admin` or `organizer`. Registers an already-uploaded file in the database.

Call this **after** the browser completes the PUT to the presigned URL.

**Request body**
```json
{
  "s3_key": "events/event-1/photos/uuid-banner.jpg",
  "original_name": "banner.jpg",
  "file_type": "photo",
  "content_type": "image/jpeg",
  "size_bytes": 204800
}
```

Verifies the key starts with `events/event-{id}/` and performs a HeadObject check to confirm the file exists in S3 before inserting the database row.

**Success** `201`
```json
{
  "data": {
    "file_id": 1,
    "event_id": 1,
    "s3_key": "events/event-1/photos/uuid-banner.jpg",
    "original_name": "banner.jpg",
    "file_type": "photo",
    "content_type": "image/jpeg",
    "size_bytes": 204800,
    "uploaded_by": 1,
    "uploaded_at": "2025-09-15T12:00:00.000Z"
  }
}
```

---

### GET /api/events/:id/files

Requires: any authenticated user.

**Query params**
| Param | Type | Description |
|---|---|---|
| `file_type` | string | Filter by type (`photo`, `report`, `poster`, `document`) |

**Success** `200`
```json
{
  "data": [
    {
      "file_id": 1,
      "event_id": 1,
      "original_name": "banner.jpg",
      "file_type": "photo",
      "content_type": "image/jpeg",
      "size_bytes": 204800,
      "uploader_name": "Alice Admin",
      "uploaded_at": "2025-09-15T12:00:00.000Z"
    }
  ]
}
```

---

### GET /api/files/:fileId/download-url

Requires: any authenticated user. Returns a presigned S3 GET URL valid for 5 minutes.

**Success** `200`
```json
{
  "data": {
    "download_url": "https://s3.amazonaws.com/your-bucket/events/event-1/photos/uuid-banner.jpg?..."
  }
}
```

---

### DELETE /api/files/:fileId

Requires: `admin` or `organizer`. Deletes both the database row and the S3 object.

**Success** `200`
```json
{ "data": { "message": "File deleted successfully" } }
```

---

## Certificates

### POST /api/events/:id/certificates

Requires: `admin` or `organizer`. Batch-creates certificate records for participants who are marked present. Participants without attendance or already having a certificate are skipped.

**Request body**
```json
{ "participant_ids": [1, 2, 3] }
```

**Success** `200`
```json
{
  "data": {
    "created": [
      { "certificate_id": 1, "participant_id": 1, "certificate_code": "TC-2025-E001-P0001" }
    ],
    "skipped": [
      { "participant_id": 3, "reason": "not present" }
    ]
  }
}
```

Certificate code format: `TC-{year}-E{eventId padded to 3 digits}-P{participantId padded to 4 digits}`

---

### GET /api/events/:id/certificates

Requires: any authenticated user.

**Success** `200`
```json
{
  "data": [
    {
      "certificate_id": 1,
      "certificate_code": "TC-2025-E001-P0001",
      "participant_id": 1,
      "participant_name": "Carol Student",
      "email": "carol@student.edu",
      "department": "Computer Science",
      "year": 2,
      "status": "issued",
      "issued_date": "2025-10-17"
    }
  ]
}
```

---

### GET /api/participants/:id/certificates

Requires: any authenticated user.

**Success** `200`
```json
{
  "data": [
    {
      "certificate_id": 1,
      "certificate_code": "TC-2025-E001-P0001",
      "event_id": 1,
      "event_title": "Annual Tech Symposium",
      "event_date": "2025-10-15",
      "category": "seminar",
      "status": "issued",
      "issued_date": "2025-10-17"
    }
  ]
}
```

---

### POST /api/certificates/:id/issue

Requires: `admin` or `organizer`. Generates a PDF certificate using pdfkit, uploads it to S3 at `certificates/event-{eventId}/{certificate_code}.pdf`, and marks the record as `issued` with today's date.

**Success** `200`
```json
{
  "data": {
    "certificate_id": 1,
    "certificate_code": "TC-2025-E001-P0001",
    "status": "issued",
    "issued_date": "2025-10-17",
    "s3_key": "certificates/event-1/TC-2025-E001-P0001.pdf"
  }
}
```

**Errors**
- `409` — certificate already issued

---

### GET /api/certificates/:id/download-url

Requires: any authenticated user. Returns a presigned S3 GET URL valid for 5 minutes.

**Success** `200`
```json
{
  "data": {
    "download_url": "https://s3.amazonaws.com/.../TC-2025-E001-P0001.pdf?..."
  }
}
```

**Errors**
- `409` — certificate has not been issued yet (PDF does not exist)

---

## Dashboard

### GET /api/dashboard/stats

Requires: any authenticated user. Returns aggregate statistics and overview data.

Scoping: a `council_lead` sees figures for its own council only. Everyone else
— `super_admin`, `council_member` and `member` — sees the platform-wide totals.
(Only the super admin additionally receives `total_councils`, `active_leads` and
`council_breakdown`.)

**Success** `200`
```json
{
  "data": {
    "total_events": 25,
    "upcoming_events": 8,
    "completed_events": 14,
    "total_participants": 320,
    "total_registrations": 1200,
    "certificates_issued": 980,
    "events_by_category": [
      { "category": "seminar", "count": 10 },
      { "category": "workshop", "count": 8 }
    ],
    "events_by_year": [
      { "year": 2024, "count": 12 },
      { "year": 2025, "count": 13 }
    ],
    "top_events": [
      {
        "event_id": 1,
        "title": "Annual Tech Symposium",
        "category": "seminar",
        "event_date": "2025-10-15",
        "participants_count": 148
      }
    ],
    "recent_uploads": [
      {
        "file_id": 10,
        "event_id": 1,
        "original_name": "banner.jpg",
        "file_type": "photo",
        "content_type": "image/jpeg",
        "size_bytes": 204800,
        "uploaded_at": "2025-09-15T12:00:00.000Z",
        "event_title": "Annual Tech Symposium"
      }
    ]
  }
}
```
