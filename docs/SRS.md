# Software Requirements Specification (SRS)

## VetTracker — Pet Health Early-Warning & Vet Triage System

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | 6 July 2026 |
| **Status** | Approved / Implemented |
| **Author** | Atri Dhar |
| **Repository** | https://github.com/AtriDhar/vet-tracker |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [System Features (Functional Requirements)](#3-system-features-functional-requirements)
4. [External Interface Requirements](#4-external-interface-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Data Requirements](#6-data-requirements)
7. [Rule Engine Specification](#7-rule-engine-specification)
8. [Assumptions and Dependencies](#8-assumptions-and-dependencies)
9. [Future Enhancements (Out of Scope for v1.0)](#9-future-enhancements-out-of-scope-for-v10)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the software requirements for **VetTracker**, a web application
that lets pet owners log daily health observations, receive **explainable, rule-based
early-warning alerts** with ER-style triage routing, book veterinary appointments, and
export consultation-ready health reports. It is intended for developers, testers,
evaluators and future maintainers of the system.

### 1.2 Scope

VetTracker addresses two linked problems:

1. **Missed early symptoms** — owners rarely notice gradual changes (rising water
   intake, slow weight loss) until disease is advanced. VetTracker compares each day's
   log against the *pet's own rolling baseline* and raises tiered, fully-explained
   alerts.
2. **Appointment friction and information loss** — when owners do reach a vet, history
   arrives as vague recollection. VetTracker books the appointment from inside the
   alert, pre-loads the clinic with the engine's reasoning, and exports a printable
   report.

The system is deliberately **rule-based (no machine learning)**: every alert must be
reproducible and auditable down to individual scoring contributions.

### 1.3 Definitions and Abbreviations

| Term | Meaning |
|---|---|
| **Baseline** | Mean of a metric over the pet's previous logs (up to 7 most recent with data) |
| **Triage tier** | One of 🟢 *home* (monitor), 🟡 *vet48* (see a vet within 48 h), 🔴 *emergency* |
| **Severity** | Alert classification: `info` / `watch` / `urgent` |
| **Triage score** | Integer sum of weighted rule contributions for one daily log |
| **Emergency override** | Symptom that forces `urgent` severity regardless of score |
| **Contagion fan-out** | Automatic warning alerts created for other pets in the same household |
| **JWT** | JSON Web Token (session mechanism) |
| **SRS** | Software Requirements Specification |

### 1.4 References

- IEEE Std 830-1998, *Recommended Practice for Software Requirements Specifications*
- `docs/DEPLOYMENT.md` — production deployment guide (free tier)
- `src/lib/rules/engine.ts` — reference implementation of Section 7

---

## 2. Overall Description

### 2.1 Product Perspective

VetTracker is a self-contained full-stack web application:

```
Browser (React 19 client components, Tailwind CSS 4)
   │  HTTPS + httpOnly session cookie
   ▼
Next.js 16 (App Router)
   ├─ Edge proxy (route guard, JWT verification)
   ├─ REST route handlers (/api/…)
   ├─ Server components (report, QR cards)
   └─ lib/ (auth, rule engine, service layer)
   │
   ▼
libSQL / SQLite  (embedded file locally · Turso hosted in production)
```

There are no external runtime service dependencies (no mail provider, no queue, no
third-party APIs); notifications are in-app, generated lazily on read.

### 2.2 User Classes

| User class | Description | Key privileges |
|---|---|---|
| **Pet owner** (`role=owner`) | Primary user; owns one or more pets | Full CRUD on own pets/logs/reminders/expenses; booking; report/QR export |
| **Veterinary staff** (`role=vet`) | Clinic account linked to one vet directory entry | Sees incoming appointments for their clinic with triage context; confirms/completes/declines |
| **Anonymous public** | No account | Toxicity checker; QR emergency card pages (token-gated) |

### 2.3 Operating Environment

- **Server:** Node.js ≥ 20; deployable to any Node host or serverless platform
  (reference deployment: Vercel Hobby + Turso free tier)
- **Client:** evergreen desktop and mobile browsers (Chrome, Edge, Firefox, Safari)
- **Database:** SQLite dialect via libSQL — embedded file (dev) or Turso (prod)

### 2.4 Design Constraints

- **DC-1** Decision logic must be deterministic and rule-based; no ML models.
- **DC-2** Every alert must persist the complete list of human-readable reasons that
  produced it.
- **DC-3** The application must run with **zero manual setup** locally
  (`npm install && npm run dev`): schema migration and seeding are automatic.
- **DC-4** All persistent state lives in the database; the filesystem is treated as
  ephemeral (serverless-compatible).
- **DC-5** Free-tier deployability: total footprint must fit Vercel Hobby and Turso
  free plan limits.

---

## 3. System Features (Functional Requirements)

Requirements use the keywords **shall** (mandatory) and **should** (desirable).
Each requirement is implemented in v1.0 unless marked otherwise.

### 3.1 Authentication & Accounts (FR-A)

- **FR-A1** The system shall allow account creation with email, password (min 8
  chars), name, and optional phone/address.
- **FR-A2** Passwords shall be stored only as bcrypt hashes (cost ≥ 10).
- **FR-A3** On login/signup the system shall issue a JWT (HS256, 7-day expiry) in an
  `httpOnly`, `SameSite=Lax` cookie; the `Secure` flag shall be set in production.
- **FR-A4** An edge-level guard shall redirect unauthenticated requests for protected
  pages (`/dashboard`, `/pets/*`, `/vets`, `/appointments`, `/vet-portal`) to `/login`.
- **FR-A5** All `/api/*` resources except toxicity lookup and auth endpoints shall
  return `401` without a valid session.
- **FR-A6** Every data query shall be scoped to the authenticated user (ownership
  checks on pet-, alert-, reminder-, expense- and appointment-level resources).
- **FR-A7** Accounts shall carry a role (`owner` | `vet`); vet accounts link to one
  vet-directory entry.

### 3.2 Pet Profiles (FR-P)

- **FR-P1** An owner shall be able to create, view, edit and delete pets (name,
  species, breed, sex, birth date, weight, avatar, medical-history notes).
- **FR-P2** One account shall support multiple pets.
- **FR-P3** Deleting a pet shall cascade-delete its logs, alerts, reminders and
  expenses.
- **FR-P4** Each pet shall receive a unique, unguessable share token at creation
  (for the public QR card, FR-Q).
- **FR-P5** The pet profile shall display the breed-specific risk profile derived
  from the static breed-risk table.

### 3.3 Daily Health Logging (FR-L)

- **FR-L1** An owner shall be able to record, per pet per calendar day: food (g),
  water (ml), activity (min), weight (kg), sleep (h), stool consistency
  (normal/soft/diarrhea/constipated/bloody), and free-text notes.
- **FR-L2** Symptoms shall be recorded via a fixed checklist (22 symptoms), not free
  text, so they can be scored deterministically.
- **FR-L3** A photo (≤ 2 MB, stored as data-URL) shall be attachable to a log entry.
- **FR-L4** All metric fields shall be optional; the engine reasons only over
  provided values.
- **FR-L5** Submitting a log for an existing date shall update that day's entry and
  re-evaluate it (previously generated alerts for that log are replaced).
- **FR-L6** Log history shall be viewable as a table and as a month calendar
  colour-coded by log presence and worst alert severity.

### 3.4 Rule-Based Alert Engine (FR-E)

- **FR-E1** On every log submission the engine shall evaluate the log against the
  pet's history and produce at most one alert, per the specification in Section 7.
- **FR-E2** Each alert shall carry: severity (`info`/`watch`/`urgent`), triage tier
  (`home`/`vet48`/`emergency`), integer score, title, the ordered list of reasons
  (each with its point contribution), and self-care tips.
- **FR-E3** The alert result shall be returned synchronously to the submitting client
  and displayed immediately with its full explanation.
- **FR-E4** Alerts shall be persisted and listable per pet (alert history); owners
  shall be able to acknowledge alerts.
- **FR-E5** *Contagion fan-out:* when an alert involves a contagious-flagged symptom
  and score ≥ 4, the system shall create a `watch`-severity warning alert for every
  other pet of the same owner, naming the source pet and suspected condition.
- **FR-E6** An in-app notification shall be generated for every alert and contagion
  warning.

### 3.5 Triage Routing (FR-T)

- **FR-T1** `urgent` alerts shall present an emergency banner and a one-tap path to
  the vet directory in **emergency mode** (24-hr clinics sorted first).
- **FR-T2** `watch` alerts shall present a "book within 48 hours" call-to-action
  that opens the booking flow pre-linked to the alert.
- **FR-T3** `info` alerts shall present home-monitoring tips only.

### 3.6 Vet Directory & Appointment Booking (FR-B)

- **FR-B1** The system shall provide a vet directory with name, clinic, specialty,
  address, phone, hours, rating and a 24-hr emergency flag.
- **FR-B2** An owner shall be able to request an appointment (pet, vet, date/time,
  reason); bookings created from an alert shall store the alert reference.
- **FR-B3** Appointment status shall follow: `pending → confirmed → completed`, with
  `cancelled` reachable by the owner (pending/confirmed) or the clinic.
- **FR-B4** Status changes by the clinic shall notify the owner in-app.

### 3.7 Vet Portal (FR-V)

- **FR-V1** Vet accounts shall see incoming appointments for their clinic ordered by
  status then time.
- **FR-V2** Each triage-linked appointment shall display severity, score and the full
  engine reasoning, plus the pet's species/breed/age/weight, medical notes, and owner
  contact — before the visit.
- **FR-V3** Vet accounts shall be able to confirm, complete or decline appointments.

### 3.8 Notifications & Reminders (FR-N)

- **FR-N1** The system shall maintain an in-app notification feed (bell with unread
  count, polled every 30 s) covering alerts, contagion warnings, bookings, status
  changes and reminders.
- **FR-N2** Owners shall be able to create reminders (vaccination / medication /
  checkup / grooming) with a due date and optional repeat interval in days.
- **FR-N3** Reminders due within 3 days (or overdue) shall generate a notification at
  most once per day; overdue repeating reminders shall roll forward automatically.
- **FR-N4** The dashboard shall list reminders due within 7 days, highlighting
  overdue ones.

### 3.9 Health Timeline (FR-H)

- **FR-H1** Each pet shall have a chronological "health story" view merging: logged
  symptoms/notes, alerts (with triage outcome), appointments (booked/completed/
  cancelled) and vet/medication expenses.

### 3.10 Exportable Vet Report (FR-R)

- **FR-R1** The system shall generate a print-optimized report per pet containing:
  patient and owner details, medical notes, 14-day metric ranges with averages,
  the daily log table, the last 10 alerts **with their full reasoning**, breed risk
  profile and preventive schedule.
- **FR-R2** The report shall be exportable to PDF via the browser print dialog with
  all application chrome removed by print CSS.

### 3.11 QR Emergency Card (FR-Q)

- **FR-Q1** For each pet the owner shall be able to view/print a card containing a QR
  code that resolves to a public page (`/card/<share-token>`).
- **FR-Q2** The public page shall show only: pet name/breed/sex/weight/avatar,
  medical notes, owner name, phone (tap-to-call) and address — no other account data.
- **FR-Q3** The public page shall require no authentication and shall not be
  discoverable by enumeration (token ≥ 16 random alphanumerics).

### 3.12 Toxicity Safety Checker (FR-X)

- **FR-X1** The system shall provide a public (no-login) search over a curated
  toxicity table (≥ 30 entries: foods, human medicines, plants, household
  substances) with alias matching (incl. regional brand names).
- **FR-X2** Results shall show a species-specific verdict per entry
  (`deadly` / `dangerous` / `caution` / `safe`) with an explanatory note, and
  highlight when dogs and cats differ.
- **FR-X3** Dangerous/deadly results shall surface an "already ingested" checklist
  and a link to emergency-mode vet search.
- **FR-X4** Unmatched queries shall return a fail-safe message advising to treat the
  substance as unsafe and consult a vet.

### 3.13 Expense Tracking (FR-C)

- **FR-C1** Owners shall be able to record per-pet expenses (category, description,
  amount, date) and delete entries.
- **FR-C2** The expense view shall show the total and per-category subtotals (INR).

### 3.14 Demo & Seeding (FR-S)

- **FR-S1** On an empty database the system shall automatically create the schema and
  seed the vet directory.
- **FR-S2** Unless `SEED_DEMO=false`, the system shall additionally seed two demo
  accounts, three pets with 14 days of date-relative logs, and run the *real* engine
  over the flagged days so demo alerts are genuine engine output.

---

## 4. External Interface Requirements

### 4.1 User Interface

- Responsive layout (mobile-first cards, desktop grid), WCAG-conscious contrast,
  emoji-based iconography, severity colour language (sky/amber/rose) consistent
  across badges, banners, calendar and charts.
- Trend charts (water/food/weight/activity) shall draw the pet's baseline as a
  reference line.

### 4.2 Software Interfaces (REST API summary)

| Endpoint | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` | POST/GET | mixed | Session lifecycle |
| `/api/pets`, `/api/pets/:id` | GET/POST/PUT/DELETE | owner | Pet CRUD + aggregated detail |
| `/api/pets/:id/logs` | POST | owner | Upsert daily log → returns engine result |
| `/api/alerts/:id` | PATCH | owner | Acknowledge alert |
| `/api/vets` | GET | session | Directory (`?emergency=1` filter) |
| `/api/appointments`, `/api/appointments/:id` | GET/POST/PATCH | role-aware | Booking + status transitions |
| `/api/notifications` | GET/PATCH | session | Feed + mark-all-read |
| `/api/reminders`, `/api/reminders/:id` | GET/POST/DELETE | owner | Reminders |
| `/api/expenses`, `/api/expenses/:id` | POST/DELETE | owner | Expenses |
| `/api/toxicity?q=` | GET | public | Toxicity lookup |

All bodies are JSON; errors use `{ "error": string }` with appropriate HTTP status
(400/401/403/404/409).

### 4.3 Communications

HTTPS in production (platform-terminated TLS). No outbound network calls at runtime.

---

## 5. Non-Functional Requirements

### 5.1 Security (NFR-S)

- **NFR-S1** `JWT_SECRET` shall be mandatory in production; the app shall refuse to
  serve auth operations without it (fail-fast).
- **NFR-S2** Session cookies: `httpOnly`, `SameSite=Lax`, `Secure` in production.
- **NFR-S3** All SQL shall use parameterized statements (no string interpolation).
- **NFR-S4** Authorization shall be enforced per-row (resource ownership joins), not
  only per-route.
- **NFR-S5** The public card shall expose only the fields listed in FR-Q2.

### 5.2 Performance (NFR-P)

- **NFR-P1** Engine evaluation shall be O(history window) with a hard cap of 30 logs
  read per evaluation; p95 API latency dominated by DB round-trips (≤ 3 queries for
  typical endpoints, aggregated via `Promise.all` where independent).
- **NFR-P2** The system shall operate within Turso free-tier limits (500 M row reads
  /month) at demo/portfolio scale.

### 5.3 Reliability & Data Integrity (NFR-R)

- **NFR-R1** Schema creation shall be idempotent (`IF NOT EXISTS`) and run
  automatically at first connection.
- **NFR-R2** One log per pet per day shall be enforced by a DB unique constraint.
- **NFR-R3** Referential integrity shall be declared with foreign keys and cascade
  rules.

### 5.4 Usability (NFR-U)

- **NFR-U1** A daily log shall be completable in under 60 seconds.
- **NFR-U2** Every alert shall be understandable by a non-technical owner (plain
  language, no rule IDs without explanation).
- **NFR-U3** The system shall display a persistent disclaimer that it is not a
  medical device and does not replace a veterinarian.

### 5.5 Maintainability & Portability (NFR-M)

- **NFR-M1** The rule engine shall be a pure function (`evaluateLog(pet, log,
  history)`) with no I/O, unit-testable in isolation.
- **NFR-M2** Veterinary knowledge (symptom weights, combos, breed risks, toxicity)
  shall live in standalone data modules editable without touching engine logic.
- **NFR-M3** A single async DB interface shall abstract embedded vs. hosted SQLite;
  swapping environments is configuration-only (env vars).
- **NFR-M4** TypeScript strict mode; zero ESLint errors.

---

## 6. Data Requirements

### 6.1 Logical Data Model

```
users 1 ──── n pets 1 ──── n logs 1 ──── 0..1 alerts (log-originated)
  │             │  1 ──── n alerts (incl. contagion, log_id NULL)
  │             │  1 ──── n reminders
  │             │  1 ──── n expenses
  │             └  1 ──── n appointments n ──── 1 vets
  │  1 ──── n notifications
  └  0..1 ──── vets   (role=vet link)
```

### 6.2 Tables

`users`, `vets`, `pets`, `logs`, `alerts`, `appointments`, `notifications`,
`reminders`, `expenses` — full DDL in `src/lib/db.ts`. Notable fields:

- `pets.share_token` — unique public token for the QR card
- `logs.symptoms` / `alerts.reasons` / `alerts.tips` — JSON arrays (TEXT)
- `alerts.contagion_source_pet_id` — set only on fan-out warnings
- `appointments.triage_alert_id` — links a booking to the alert that suggested it

### 6.3 Static Knowledge Tables (code-resident)

- `data/symptoms.ts` — 22 symptoms: weight, category, emergency flag, contagious condition
- `data/breeds.ts` — 13 breed groups → risk categories with owner-readable notes
- `data/toxicity.ts` — 32 substances with per-species verdicts and aliases

---

## 7. Rule Engine Specification

Deterministic pipeline; every fired rule appends `(reason, points)` to the alert.

**7.1 Baseline.** For metric *m*: mean of up to the 7 most recent prior logs having
*m* (minimum 3 data points, else the rule is skipped; weight requires 2).

**7.2 Threshold rules**

| ID | Condition | Points |
|---|---|---|
| W1 | water > 1.4 × baseline | +3 |
| W2 | water > 1.8 × baseline (replaces W1's +3 with +5) | +5 |
| W3 | 3-day mean water > 1.4 × preceding-week baseline (sustained) | +2 |
| F1 | food = 0 today | +5 |
| F2 | food = 0 second consecutive day | +4 and emergency override |
| F3 | food < 0.5 × baseline | +3 |
| G1 | weight down > 5% vs. reference | +5 |
| G2 | weight down > 10% vs. reference (replaces G1) | +7 |
| A1 | activity < 0.5 × baseline | +2 |
| S1 | sleep > 1.4 × baseline | +2 |

**7.3 Stool rules.** soft +1 · constipated +1 · diarrhea +2 (+2 per continued streak
day) · bloody +5 with emergency override.

**7.4 Symptom weights.** Per `data/symptoms.ts` (e.g. vomiting 3, lethargy 2,
breathing difficulty 6ᴱ, seizure 6ᴱ, collapse 6ᴱ, straining to urinate 5ᴱ, bleeding
5ᴱ, bloated abdomen 5ᴱ, pale gums 5ᴱ — ᴱ = emergency override).

**7.5 Combination bonuses.** vomiting+lethargy+no-appetite +3 · thirst+frequent-
urination +3 · cough+breathing-difficulty +2 · vomiting+bloat +4 · shaking+fever +2.
(Zero food counts as *no appetite* for combination matching.)

**7.6 Breed modifier.** +2 per breed-risk entry whose category matches any category
touched by fired rules, with the breed note included as a reason.

**7.7 Age modifier.** +1 if senior (dog ≥ 8 y, cat ≥ 10 y) and score ≥ 2.

**7.8 Tier mapping.**

| Score | Severity | Triage |
|---|---|---|
| ≥ 8 or emergency override | `urgent` | `emergency` |
| 4 – 7 | `watch` | `vet48` |
| 1 – 3 | `info` | `home` |
| 0 | *no alert* | — |

**7.9 Contagion fan-out.** If a fired symptom is contagious-flagged and score ≥ 4,
create a `watch`/`home` warning for each household sibling naming the condition and
isolation tips.

---

## 8. Assumptions and Dependencies

- Owners log honestly and roughly daily; the engine degrades gracefully with sparse
  data (rules requiring baselines simply don't fire).
- Symptom weights, thresholds and breed risks encode general veterinary heuristics
  for demonstration; a production medical release would require professional review
  (see disclaimer, NFR-U3).
- The vet directory is seeded reference data; real clinic onboarding is out of scope.
- Free-tier platform limits (Vercel Hobby, Turso free) are sufficient for
  portfolio/demo traffic.

## 9. Future Enhancements (Out of Scope for v1.0)

- Email/push notification channels (currently in-app only)
- Vet-authored visit outcomes feeding back into the timeline
- Weight-dosed medication reminders and toxicity dose calculators
- Multi-user households (shared pet custody) and care-circle roles
- Attachment storage on object storage instead of data-URLs
- Localization (i18n) and unit preferences (imperial)
