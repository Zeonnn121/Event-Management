# CLAUDE.md — Technical Council Frontend Build Prompt

> **How to use this file:** This is the authoritative brief for building the
> Technical Council web client. Read it fully before writing code. Work in
> `frontend/`, replacing the current placeholder in place. Treat every `MUST`,
> `SHOULD`, and `MUST NOT` as a requirement unless the user says otherwise.
> If anything is ambiguous, ask one crisp question rather than guessing.

---

## 0. Mission

## 0.1 Installed Claude Code skills/plugins

The project environment already has these Claude Code skills/plugins installed. **Use them when they are relevant; do not reinstall or replace them with alternative tooling.**

### `taste-skill` — visual taste and frontend quality
- Use `taste-skill` when making or reviewing UI/UX, visual hierarchy, typography, spacing, color usage, component composition, polish, or overall frontend aesthetics.
- Apply its guidance to make the product feel intentionally designed rather than like a generic component-library/admin template.
- Use it alongside the explicit design system in this file. The requirements in this file remain authoritative; use `taste-skill` to improve execution within those constraints.
- Before considering a major UI surface finished, use the skill's guidance to review visual quality, consistency, hierarchy, and unnecessary visual clutter.

### `ponytail` — implementation/workflow assistance
- Use the installed `ponytail` skill whenever its capabilities are relevant to the current implementation task.
- Prefer it for the workflows it is designed to support rather than manually recreating the same workflow.
- Do not add duplicate dependencies or tooling merely to reproduce functionality already provided by the installed skill.

### Obsidian skills — knowledge/documentation workflows
- Use the installed Obsidian skills when the task involves project notes, documentation, structured knowledge, references, planning material, or other Obsidian-related workflows.
- Keep project implementation source-of-truth in the repository unless the user explicitly asks for an Obsidian workflow.
- Do not create or modify Obsidian vault content unless it is requested or clearly required by the task.

### Skill usage rules
1. **Check the relevant installed skill before doing work that falls within its domain.**
2. **Actually apply useful guidance from the skill**, rather than merely mentioning that the skill exists.
3. Do not let a skill override the hard requirements, API contract, security constraints, accessibility requirements, or acceptance criteria in this document.
4. If two skill recommendations conflict, prefer this `CLAUDE.md`, then the existing project architecture, then the least invasive implementation.
5. Do not install another skill/plugin for a capability already covered by these installed skills.
6. When reporting completed work, briefly mention which installed skills were materially used when relevant.

Build a **beautiful, fast, accessible React SPA** for a college Technical
Council to run event operations end to end: browse and manage events, register
participants (with waitlists), take attendance, upload event media directly to
S3, generate and download PDF certificates, and view an analytics dashboard.

The backend is already built (Express + TypeScript + MySQL + S3). **Do not
change the backend.** Build the client against the API contract in §9.

The app should feel like a polished modern SaaS product — not a bootstrap admin
template. Motion, hierarchy, and feedback are first-class, not afterthoughts.

---

## 1. Hard constraints (non-negotiable)

These keep the existing deploy pipeline working. The deploy script runs
`npm ci` and `npm run build` inside `frontend/` and serves `frontend/dist`.

1. **`npm ci` MUST work** — commit an up-to-date `package-lock.json`.
2. **`npm run build` MUST emit a static `frontend/dist/`** with an
   `index.html` entry point (Vite default output dir is `dist` — keep it).
3. **`frontend/dist` MUST be served under an arbitrary path prefix safely** —
   use `base: "./"` (relative asset paths) in `vite.config.ts`.
4. **No inline `<script>` or inline event handlers** (`onclick=`). Production
   CSP is `script-src 'self'`. All JS must be bundled external files.
5. **No CDN fonts that break CSP** — self-host or use system font stack. If
   using a font file, serve it from `public/` (same-origin) so `font-src 'self'`
   is satisfied. Do not add external `<link>` to Google Fonts.
6. **Images** may load from `https://*.amazonaws.com` (presigned S3) — already
   allowed by CSP.
7. Keep `frontend/README.md`'s spirit: this folder is self-contained.

---

## 2. Tech stack (use exactly this unless a dependency already exists)

| Concern | Choice |
| --- | --- |
| Build | **Vite** + React 18/19 + **TypeScript (strict)** |
| Routing | **React Router** (data router, `createBrowserRouter`) |
| Server state | **TanStack Query v5** |
| Client state | **Zustand** (auth session, UI prefs) |
| Forms | **react-hook-form** + **Zod** resolver (`@hookform/resolvers`) |
| Styling | **Tailwind CSS** + `clsx` + `tailwind-merge` (`cn()` helper) |
| Primitives | **Radix UI** (dialog, dropdown, tabs, tooltip, select, toast) for a11y |
| Motion | **Framer Motion** (`motion`) |
| Icons | **lucide-react** |
| Charts | **Recharts** |
| Dates | **date-fns** |
| Toasts | Radix Toast or **sonner** |

Do not introduce a second styling system (no CSS-in-JS runtime). Prefer
Tailwind utilities; extract component classes with `cva` (class-variance-authority)
if needed.

---

## 3. Project structure

```
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env.example
├── public/                  # static assets, self-hosted font if any
└── src/
    ├── main.tsx
    ├── App.tsx              # providers + router
    ├── styles/index.css     # Tailwind layers + tokens
    ├── lib/
    │   ├── api.ts           # fetch wrapper, envelope unwrap, error normalize
    │   ├── queryClient.ts
    │   ├── cn.ts
    │   └── format.ts        # date/number/bytes helpers
    ├── stores/
    │   └── auth.ts          # token + user, persisted to localStorage
    ├── hooks/               # useAuth, useEvents, useDebounce, useMediaQuery...
    ├── components/
    │   ├── ui/              # Button, Input, Dialog, Table, Badge, Skeleton...
    │   ├── layout/          # AppShell, Sidebar, Topbar, PageTransition
    │   └── domain/          # EventCard, AttendanceGrid, CertificateRow...
    ├── pages/               # one folder per route
    └── routes.tsx
```

---

## 4. Design system

Use the installed `taste-skill` as a visual-quality reviewer and implementation aid for this entire section. It should influence hierarchy, composition, spacing, typography, interaction polish, and visual restraint while staying within the explicit tokens and requirements below.

Define these as CSS variables in `styles/index.css` and mirror them in
`tailwind.config.ts`. **Support light and dark mode** (class strategy, respects
`prefers-color-scheme`, user toggle persisted).

### 4.1 Color tokens

Academic-technical, confident, energetic. Deep indigo primary, cyan accent.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#f8fafc` | `#0b1020` | app background |
| `--surface` | `#ffffff` | `#131a2e` | cards, panels |
| `--surface-2` | `#f1f5f9` | `#1b2338` | inset, hover rows |
| `--border` | `#e2e8f0` | `#26304a` | hairlines |
| `--text` | `#0f172a` | `#e6ebf5` | primary text |
| `--muted` | `#64748b` | `#94a3b8` | secondary text |
| `--primary` | `#4f46e5` | `#6366f1` | primary actions, links |
| `--primary-fg` | `#ffffff` | `#ffffff` | on-primary text |
| `--accent` | `#06b6d4` | `#22d3ee` | highlights, data viz |
| `--success` | `#16a34a` | `#4ade80` | issued, present, registered |
| `--warning` | `#d97706` | `#fbbf24` | waitlisted, pending |
| `--danger` | `#dc2626` | `#f87171` | cancel, errors, delete |
| `--info` | `#2563eb` | `#60a5fa` | informational |

Rules:
- Primary actions use `--primary`; never use raw Tailwind blue/purple.
- Data-viz palette (dashboard charts) = `[primary, accent, success, warning, info]`.
- Status badges (below) map event/certificate/registration states to semantic colors.

### 4.2 Status → color mapping

| Domain | State | Treatment |
| --- | --- | --- |
| Event | `planned` | neutral/slate |
| Event | `registration_open` | success/green |
| Event | `ongoing` | accent/cyan (pulsing dot) |
| Event | `completed` | info/blue |
| Event | `cancelled` | danger/red, struck-through title |
| Registration | `registered` | success |
| Registration | `waitlisted` | warning |
| Registration | `cancelled` | muted |
| Certificate | `pending` | warning |
| Certificate | `issued` | success |

### 4.3 Typography

- Font stack: `Inter`, then `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Self-host Inter via `public/fonts` with `@font-face` (no external CDN).
- Scale: `text-xs 12` / `sm 14` / `base 16` / `lg 18` / `xl 20` / `2xl 24` / `3xl 30` / `4xl 36`.
- Headings: `font-semibold tracking-tight`. Body: `leading-relaxed`.
- Numbers in stats use `tabular-nums`.

### 4.4 Spacing, radius, elevation

- Spacing: Tailwind 4px scale. Page gutters `p-4 md:p-6 lg:p-8`; content max-width `1280px`.
- Radius: `sm 6px`, `md 10px`, `lg 14px`, `full 9999`. Cards/inputs `md`, modals `lg`, pills/dots `full`.
- Shadow: `sm` hairline, `md` card rest, `lg` popover/dialog. In dark mode reduce shadow and lean on borders.

### 4.5 Layout

- **AppShell**: fixed left sidebar (icon+label, collapses to icons under `lg`), top bar with search, org name, theme toggle, user menu.
- Sidebar nav: Dashboard, Events, Participants, Certificates. Show Users only to `admin`.
- Content switches with the page-transition wrapper (§6.1).
- Fully responsive: sidebar becomes a slide-in drawer on mobile; tables become card lists under `md`.

---

## 5. Component inventory (build these in `components/ui` first)

Button (variants: primary, secondary, ghost, danger; sizes sm/md/icon; loading state), Input, Textarea, Select (Radix), Checkbox, DatePicker (native or Radix), Badge/StatusBadge, Card, Table (sortable header, row hover), Dialog/Modal, Drawer/Sheet, Tabs, Tooltip, DropdownMenu, Avatar, Pagination, Skeleton, EmptyState, ErrorState, Toast, ProgressRing, Stat, Breadcrumb, CommandPalette (optional, `⌘K`).

Every interactive component MUST have visible `focus-visible` ring
(`ring-2 ring-offset-2 ring-[--primary]`) and keyboard support.

---

## 6. Motion & animation system

Use **Framer Motion**. Centralize variants in `lib/motion.ts` so timing is
consistent. Tokens:

```ts
export const duration = { fast: 0.15, base: 0.25, slow: 0.4 };
export const ease = {
  standard: [0.2, 0, 0, 1],   // enter/exit
  emphasized: [0.16, 1, 0.3, 1], // spring-like overshoot
};
```

### 6.1 Page transitions
- Wrap route content in `<PageTransition>` using `AnimatePresence mode="wait"`.
- Enter: `opacity 0→1`, `y 8→0`, duration `base`, ease `standard`.
- Exit: `opacity 1→0`, duration `fast`. Keep it subtle (< 300ms total) so navigation feels instant.

### 6.2 List & grid reveals (stagger)
- Cards/rows animate in with `staggerChildren 0.04`, each item `opacity 0→1, y 12→0` over `base`.
- Cap total stagger so a 50-row page doesn't take a second — only stagger the first ~12, then render the rest statically.

### 6.3 Micro-interactions
- Buttons: scale `0.98` on press (`whileTap`), background transition `fast`.
- Event/stat cards: on hover, lift `y -2` and elevate shadow over `fast`; respect `prefers-reduced-motion` (disable lift).
- Sidebar nav active item: animated `layoutId` pill that slides between items.
- Tabs: animated underline via `layoutId`.
- Theme toggle: icon cross-fade + rotate 20°.

### 6.4 Modals & drawers
- Backdrop: fade `fast`. Panel: `opacity 0→1`, `scale 0.96→1`, `y 8→0`, spring `{ stiffness: 320, damping: 30 }`.
- Exit reverses in `fast`. Trap focus, close on Esc and backdrop click, restore focus on close.

### 6.5 Feedback & state
- **Skeletons**: shimmer placeholder rows/cards while queries load — never a bare spinner for page content.
- **Toasts**: slide in from bottom-right, auto-dismiss 5s, with a 4px progress bar; success/error variants. Certificate issuance shows a success toast with a "Download" action.
- **Optimistic UI** for attendance toggles and status changes; roll back + error toast on failure.
- **Number count-up** for dashboard stat values on first mount (~600ms, `easeOut`).
- **Confetti burst** (`canvas-confetti`, ~700ms) the first time a certificate is successfully issued. Disable under reduced motion.
- **Form errors**: field-level message slides down (`opacity/y`, `fast`) and the invalid field shakes subtly (2px, 3 cycles) — reduced-motion disables the shake.

### 6.6 Accessibility for motion (required)
- Respect `prefers-reduced-motion: reduce`: disable transforms, confetti, count-up, and shake; keep only opacity fades ≤150ms.
- Never animate anything that blocks input for more than 400ms.
- No autoplaying looping animations except the subtle "ongoing" status pulse.

---

## 7. Routing

Public: `/login`.
Protected (redirect to `/login` if no token; preserve intended path):

| Path | Page | Notes |
| --- | --- | --- |
| `/` | Dashboard | stats + charts |
| `/events` | Events list | filters, search, pagination, grid/list toggle |
| `/events/new` | Create event | admin/organizer |
| `/events/:id` | Event detail | tabs: Overview, Registrations, Attendance, Files, Certificates, Outcome |
| `/events/:id/edit` | Edit event | admin/organizer |
| `/participants` | Participants list | search, pagination |
| `/participants/new` | Create participant | admin/organizer |
| `/participants/:id` | Participant detail | participation history |
| `/certificates` | Certificates overview | by event / by participant |
| `/users` | Users | admin only |
| `*` | 404 | friendly, illustrated, link home |

Guard by role using the role hierarchy: `admin` > `organizer` > `member`. Hide
UI a non-permitted role cannot use; still handle 403 from the API gracefully.

---

## 8. Page requirements

### Login
Centered card on a subtle animated gradient/aurora background (respect reduced
motion). Email + password, inline validation, loading button, error from API.
On success store token+user and redirect. Show seeded demo credentials in a
discreet helper when `import.meta.env.DEV`.

### Dashboard
Stat cards (total events, upcoming, completed, participants, registrations,
certificates issued) with count-up. Charts (Recharts): bar = events by category,
line/area = events by year. "Top events" list and "Recent uploads" list with
thumbnails. Skeleton while loading. Empty states when there's no data yet.

### Events list
Search box (debounced 300ms), filter chips/dropdowns populated from
`GET /events/meta/filters` (category, year, department, status), sort control,
pagination. Grid of `EventCard`s (responsive 1/2/3 cols) with status badge,
date, venue, capacity/registration progress bar, organizer. Toggle grid/list.
"New event" button (role-gated). Search/filter state synced to URL query params
so links are shareable and back/forward works.

### Event detail
Header with title, status badge, date/time, venue, capacity. Tabs:
- **Overview**: description, coordinator, organizers (add/remove for
  admin/organizer), outcome summary.
- **Registrations**: table with participant, status badge, registered date;
  register participant (searchable picker); cancel (shows waitlist-promotion
  effect). Capacity/waitlist indicators.
- **Attendance**: grid of registered participants with present/absent toggles,
  "mark all present", save (optimistic), summary counts (registered/present/absent).
- **Files**: upload zone (drag & drop) implementing the **two-step S3 flow**
  (§9.4), grouped by file type with thumbnails, download (presigned) and delete.
- **Certificates**: create records for present participants (shows created vs
  skipped with reasons), issue (PDF), download, status badges.
- **Outcome**: form (participants_count, feedback_score 0–5, winners,
  description); only enabled when event is `completed`; explain why otherwise.

Status control: a dropdown/stepper showing only **valid transitions**
(planned → registration_open → ongoing → completed; → cancelled from any
non-terminal state). Terminal states disabled with a tooltip.

### Participants
List with search + department/year filters + pagination. Detail shows profile and
a timeline/table of `participation_history` (event, registration status,
present, certificate status).

### Certificates
Overview to browse certificates by event or by participant, with status and a
direct download action. Issued certificates get a green badge.

### Users (admin)
List with role filter; create user form (name, email, password ≥8, role,
department). Never render password anywhere.

### 403 / 404 / error
Friendly illustrated states with a clear next action, plus a global error
boundary that catches render crashes.

---

## 9. API contract (build against THIS, not docs/API.md)

`docs/API.md` is partly stale. The following reflects the real implementation.

### 9.1 Basics
- Base URL: `import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"`. All
  calls are prefixed with `/api`.
- **Response envelope**: success is `{ "data": ... }`; some list endpoints also
  return sibling fields (`page`, `limit`, `total`); attendance returns a sibling
  `summary`. Always read those siblings, not from inside `data`.
- **Error envelope**: `{ "error": { "message": string, "details"?: unknown } }`.
  Map status → friendly UI: 400 validation, 401 → log out + redirect,
  403 → "no permission" state, 404 → not-found, 409 → conflict toast,
  429 → login rate-limit message, 500 → generic.
- **Auth**: `Authorization: Bearer <token>`. Token is a JWT valid ~8h. On 401,
  clear session and redirect to `/login`.
- **Field naming is snake_case.** Do not camelCase API payloads; render them as-is.
- **Dates** are `YYYY-MM-DD` (dates) or ISO timestamps. Format with date-fns.
- **Pagination**: query `page` (default 1), `limit` (default 20, max 100).

### 9.2 Endpoints

Auth
- `POST /api/auth/login` → `{ data: { token, user } }`. Rate limited 10/min/IP → 429.
- `GET /api/auth/me` → current user.

Users
- `POST /api/users` (admin) `{ name, email, password(≥8), role, department? }`
- `GET /api/users` (admin/organizer) `?role=`

Events
- `GET /api/events/meta/filters` → `{ data: { categories[], years[], departments[] } }`
- `GET /api/events` — query: `q, year, category, status, department, organizer, min_participants, from, to, sort, page, limit`. `sort ∈ date_desc|date_asc|title`. Returns `{ data: Event[], page, limit, total }`.
- `GET /api/events/:id` → event + `organizers[]`, `registration_count`, `file_count`, `outcome|null`.
- `POST /api/events` (admin/organizer). Body: `{ title, description?, category, event_date, start_time, end_time, venue, coordinator_id?, capacity (default 100), registration_deadline? }`. Constraint: `end_time > start_time` and `registration_deadline <= event_date`. **409** on venue/time scheduling conflict (returns conflicting event details).
- `PUT /api/events/:id` (admin/organizer) — partial update, same constraints/conflict.
- `PATCH /api/events/:id/status` `{ status }` — only valid transitions; invalid → **400**.
- `DELETE /api/events/:id` (admin) → 204.
- `GET /api/events/:id/organizers` → list.
- `POST /api/events/:id/organizers` `{ user_id, responsibility }` → 201; duplicate → 409.
- `DELETE /api/events/:id/organizers/:organizerId` → 204.
- `PUT /api/events/:id/outcome` (admin/organizer, **completed events only**) `{ participants_count?, feedback_score? (0–5), winners?, description? }` → upsert. Non-completed → 400. Omitted `participants_count` defaults to present-attendance count.
- `GET /api/events/:id/outcome` → outcome, or **404** if none.

⚠️ Use **`capacity`** (not `max_participants`), and include `start_time`/`end_time`
(mandatory on create) and optional `coordinator_id`.

Participants
- `GET /api/participants` — `?q, department, year, page, limit` → `{ data, page, limit, total }`.
- `POST /api/participants` (admin/organizer) `{ name, email, department, year(1–4), phone? }` → 201; duplicate email → 409.
- `GET /api/participants/:id` → participant + `participation_history[]`.
- `PUT /api/participants/:id` (admin/organizer) — partial.

Registrations & attendance
- `POST /api/events/:id/registrations` (admin/organizer) `{ participant_id }` → 201 with `status: registered|waitlisted`. Event must be `planned|registration_open` and deadline not passed (else 400); duplicate → 409.
- `GET /api/events/:id/registrations` → list.
- `PATCH /api/registrations/:id` `{ status: "cancelled" }` → cancelling a `registered` slot auto-promotes the oldest `waitlisted` participant.
- `PUT /api/events/:id/attendance` `{ records: [{ participant_id, present }] }` — all IDs must be `registered` (else 400). Upsert.
- `GET /api/events/:id/attendance` → `{ data: rows, summary: { registered, present, absent } }`.

Files (two-step direct-to-S3)
1. `POST /api/events/:id/files/upload-url` `{ file_name, file_type, content_type, size_bytes }` → `{ data: { upload_url, s3_key } }`. `file_type ∈ photo|report|poster|document`; max **10 MB**; content-type must match the allow-list (photo: jpeg/png/webp; report: pdf; poster: jpeg/png/webp/pdf; document: pdf/docx) else 400.
2. Browser `PUT`s bytes to `upload_url` with the same `Content-Type` header. Show real upload progress (use `XMLHttpRequest` for progress events).
3. `POST /api/events/:id/files` `{ s3_key, original_name, file_type, content_type, size_bytes }` → 201.
- `GET /api/events/:id/files?file_type=` → list (uploader field is `uploaded_by_name`).
- `GET /api/files/:fileId/download-url` → `{ data: { url } }` (5 min).
- `DELETE /api/files/:fileId` (admin/organizer).

Certificates
- `POST /api/events/:id/certificates` (admin/organizer) `{ participant_ids: number[] }` → **201** `{ data: { created[], skipped: [{participant_id, reason}] } }`. Only participants marked present get one; reasons include not_present/duplicate/participant_not_found.
- `GET /api/events/:id/certificates` → list.
- `GET /api/participants/:id/certificates` → list.
- `POST /api/certificates/:id/issue` (admin/organizer) → generates PDF + uploads; already issued → 409.
- `GET /api/certificates/:id/download-url` → `{ data: { url } }` (5 min); not issued → 409.

Dashboard
- `GET /api/dashboard/stats` → `{ data: { total_events, upcoming_events, completed_events, total_participants, total_registrations, certificates_issued, events_by_category[], events_by_year[], top_events[], recent_uploads[] } }`.

Health (optional liveness indicator)
- `GET /health`, `GET /health/db`.

### 9.3 API client conventions
- One typed `apiFetch<T>(path, options)` that: attaches the bearer token, parses
  the envelope, throws a normalized `ApiError { status, message, details }`, and
  triggers global logout on 401.
- Type every response. Define types in `src/lib/types.ts` matching the
  snake_case payloads above.
- TanStack Query keys: `["events", filters]`, `["event", id]`,
  `["participants", filters]`, `["dashboard"]`, etc. Invalidate related keys on
  mutation.

### 9.4 Presigned upload — exact sequence
```
1. POST /api/events/:id/files/upload-url      → { upload_url, s3_key }
2. PUT  upload_url  (Content-Type header, raw bytes, progress)
3. POST /api/events/:id/files  { s3_key, ... } → register in DB
```
Handle each step's failure separately with clear messaging (expired URL → 403
from S3 → retry by re-requesting a URL).

---

## 10. State, forms, and UX conventions

- **Auth store**: `{ token, user, setSession, clear }`, persisted to
  `localStorage`; hydrate on boot and validate via `/auth/me`.
- **Forms**: react-hook-form + Zod; show field errors inline; disable submit
  while pending; prevent double-submit; toast on success; surface 409/400
  messages from the API on the relevant field when possible.
- **Queries**: show skeletons on first load, dim/keepPreviousData on refetch,
  `EmptyState` when the list is empty, `ErrorState` with retry on failure.
- **Debounce** search inputs (300ms) and reflect them in the URL.
- **Downloading** a presigned URL: open the returned `url` in a new tab or
  trigger an anchor download; never hardcode buckets.
- **Never** log tokens/secrets. **Never** render password hashes (they're absent
  from responses — keep it that way).

---

## 11. Accessibility & responsiveness

- Target **WCAG 2.1 AA**: color contrast ≥ 4.5:1 for text, visible focus, full
  keyboard operation, `aria-*` on custom controls, dialogs/drawers trap focus.
- Respect `prefers-reduced-motion` everywhere (§6.6).
- Responsive breakpoints: mobile `< 640`, tablet `640–1024`, desktop `> 1024`.
  Tables become stacked cards on mobile. Test the whole flow at 375px width.
- Announce async results (uploads, saves) via an `aria-live` region.

---

## 12. Config & scripts

`.env.example` (frontend):
```
VITE_API_BASE_URL=http://localhost:4000
```

`package.json` scripts (minimum):
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  }
}
```

`vite.config.ts` MUST set `base: "./"` and output to `dist/`.

---

## 13. Definition of done (acceptance checklist)

In addition to the technical checks below, use the installed skills as part of the final review:
- [ ] `taste-skill` guidance has been applied to the major UI surfaces and the result does not feel like a generic admin/template UI.
- [ ] Relevant `ponytail` workflows were used where applicable instead of duplicating their functionality manually.
- [ ] Relevant Obsidian skills were used for any explicitly requested Obsidian/documentation workflow.

- [ ] `npm ci && npm run build` succeeds from a clean checkout and emits `dist/index.html` + hashed assets.
- [ ] No inline scripts/handlers; app runs under the backend CSP.
- [ ] `npm run typecheck` and `npm run lint` pass with no errors.
- [ ] Login works against the real API; token persisted; 401 logs out cleanly.
- [ ] Every route in §7 exists with loading/empty/error states.
- [ ] Role gating works: member sees no admin/organizer actions; 403 handled.
- [ ] Full event lifecycle works end to end: create → open registration →
      register (incl. waitlist + auto-promote) → attendance → completed → outcome → certificates (create, issue, download).
- [ ] File upload works via the two-step presigned flow with progress + failure handling.
- [ ] Dashboard renders real data with charts and count-up.
- [ ] Motion system implemented per §6 and fully disabled/simplified under `prefers-reduced-motion`.
- [ ] Light + dark mode both look intentional.
- [ ] Keyboard-only walkthrough completes every primary task.
- [ ] Looks genuinely polished at 375px, 768px, and 1440px.

---

## 14. Working agreement

- **Ask before** choosing an unfamiliar dependency, changing the API, or
  touching files outside `frontend/`.
- **Prefer editing existing files** over creating parallel ones.
- Small, reviewable commits; run `npm run typecheck` after meaningful changes.
- If you find a mismatch between this brief and the backend, trust the backend
  route code and note the discrepancy — do not silently invent fields.
- Report what you built, what you couldn't verify (e.g. needs a live API), and
  suggested next steps.
