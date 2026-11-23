# School Management API

Node.js + TypeScript + Express backend with PostgreSQL (Drizzle), Better Auth, and Zod validation.

**Base URL (local):** `http://localhost:3000` (set via `PORT` in `.env`)

---

## Quick start

```bash
cp .env.example .env
# Set DATABASE_URL, BETTER_AUTH_SECRET (min 32 chars), BETTER_AUTH_URL

npm install
npm run db:migrate
npm run dev
```

Create the first admin:

```bash
npx auth@latest create-admin --email admin@school.local --password "YourSecurePass123" --name "Admin" --role admin
```

---

## Roles & access

| Role | How assigned | Scope |
|------|----------------|--------|
| **admin** | `create-admin` CLI or Better Auth admin plugin | Full mutations; all student & staff APIs |
| **student** | Created by admin after admission (no public sign-up) | Read own data only when admitted and linked |
| **staff/teacher** | *No login* | Records managed only by admin under `/api/staff` |

### Authentication (session cookie)

Most routes need a logged-in session. After sign-in, Better Auth sets a **session cookie**. Send requests with:

- `credentials: "include"` (browser/fetch), or  
- Cookie header in Postman/Insomnia/curl

**JSON body routes:** `Content-Type: application/json`  
**File uploads:** `multipart/form-data` with field name `file`

---

## Response format

**Success**

```json
{
  "success": true,
  "data": {}
}
```

List endpoints also return:

```json
{
  "meta": { "page": 1, "limit": 20, "total": 42 }
}
```

**Error**

```json
{
  "success": false,
  "message": "Human-readable message",
  "details": {}
}
```

(`details` appears on validation errors.)

---

## Conventions

| Topic | Rule |
|-------|------|
| Dates | `YYYY-MM-DD` (e.g. `2025-11-22`) |
| Pagination | Query: `page` (default `1`), `limit` (default `20`, max `100`) |
| Money (staff) | Amounts in **paise** (₹1 = `100` paise). Example: ₹45,000 → `4500000` |
| IDs | UUID strings in path/body |
| Uploads | PDF, JPEG, PNG, WebP; max **10 MB** |

---

## 1. Root & health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | No | API index with doc links |
| `GET` | `/api/health` | No | Server health check |
| `GET` | `/api/health/me` | Yes | Returns current session + user (debug auth) |

### `GET /api/health`

**Does:** Confirms API is running.

**Response** `data`**:** `message`, `timestamp`

---

## 2. Better Auth (`/api/auth/*`)

Handled by Better Auth (not custom controllers). Mount path: `/api/auth/*splat`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/auth/ok` | No | Auth server health |
| `POST` | `/api/auth/sign-up/email` | **Disabled** | Public student sign-up is turned off |
| `POST` | `/api/auth/sign-in/email` | No | Login with email + password |
| `POST` | `/api/auth/sign-out` | Session | Logout |
| `GET` | `/api/auth/get-session` | Session | Current session |

Admin user management (requires **admin** session) — see [Better Auth Admin](https://www.better-auth.com/docs/plugins/admin), e.g.:

- `POST /api/auth/admin/create-user`
- `POST /api/auth/admin/set-role`

### Student portal login policy

1. School completes **registration** (approved) and **admission** (admin).  
2. Admin creates the login via **`portalAccess` on admission** or **`POST /api/students/:id/portal-access`** (uses Better Auth `createUser` + links `students.userId`).  
3. Only then can the student **`POST /api/auth/sign-in/email`**.  
4. Sign-in is rejected if the user is not linked to an **admitted** student (`admitted`, `transferred`, or `left` lifecycle).

### Sign in

```http
POST /api/auth/sign-in/email
Content-Type: application/json

{
  "email": "admin@school.local",
  "password": "YourSecurePass123"
}
```

Use the returned session cookie for all `/api/students` and `/api/staff` calls.

---

## 3. Student management (`/api/students`)

All routes require **authentication**.  
**Admin-only** routes are marked **Admin**.

Students see only records linked to their account (`students.userId` = logged-in user id). Link via `PATCH /api/students/:id/link-user` (admin).

---

### 3.1 Profile

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/api/students/me` | Student | Own profile + latest inquiry, registration, admission |
| `GET` | `/api/students/profile/:id` | Student (own) / Admin (any) | Single student master record |
| `PATCH` | `/api/students/:id/link-user` | **Admin** | Link existing auth user (student must already be **admitted**) |
| `POST` | `/api/students/:id/portal-access` | **Admin** | Create login + link after admission |

`PATCH .../link-user` **body**

```json
{ "userId": "<better-auth-user-id>" }
```

**Does:** Lets a student log in and access their own inquiries, certificates, etc.

---

### 3.2 Student inquiry

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/api/students/inquiries` | Student (own) / Admin (all) | Paginated inquiry list |
| `GET` | `/api/students/inquiries/:id` | Student (own) / Admin | Inquiry detail |
| `POST` | `/api/students/inquiries` | **Admin** | Create inquiry + new student (`lifecycleStatus: inquiry`) |
| `PATCH` | `/api/students/inquiries/:id` | **Admin** | Update inquiry fields / status |
| `POST` | `/api/students/inquiries/:id/convert-registration` | **Admin** | Convert open inquiry → registration row |

**List query:** `page`, `limit`, `status` (`open`  `converted`  `closed`), `search`

`POST /inquiries` **body (required + common fields)**

```json
{
  "inquirerName": "Mr. Singh",
  "firstName": "Aarav",
  "lastName": "Singh",
  "email": "parent@example.com",
  "phone": "9876543210",
  "intendedClass": "Class 9",
  "intendedStream": "Science",
  "academicYear": "2025-26",
  "notes": "Visited campus",
  "userId": "optional-auth-user-id-to-prelink"
}
```

`PATCH /inquiries/:id` **body (all optional):** `inquirerName`, `email`, `phone`, `intendedClass`, `intendedStream`, `academicYear`, `notes`, `status`

**Convert body**

```json
{
  "registrationDate": "2025-04-10",
  "remarks": "Documents received"
}
```

**Does:** Sets inquiry status to `converted`, creates `student_registrations` with status `pending`, updates student to `registered`.

---

### 3.3 Student registration

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/api/students/registrations` | Student (own) / Admin | List registrations |
| `GET` | `/api/students/registrations/:id` | Student (own) / Admin | Registration detail |
| `POST` | `/api/students/registrations` | **Admin** | Register existing student |
| `PATCH` | `/api/students/registrations/:id` | **Admin** | Update status / remarks / date |

**List query:** `page`, `limit`, `status` (`pending`  `approved`  `rejected`), `studentId` (admin)

`POST` **body**

```json
{
  "studentId": "<uuid>",
  "inquiryId": "<uuid-optional>",
  "registrationDate": "2025-04-10",
  "remarks": "Fee pending"
}
```

`PATCH` **body (optional):** `status`, `remarks`, `registrationDate`

---

### 3.4 Student admission

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/api/students/admissions` | Student (own) / Admin | List admissions |
| `GET` | `/api/students/admissions/:id` | Student (own) / Admin | Admission detail |
| `POST` | `/api/students/admissions` | **Admin** | Admit student (**requires approved registration**); optional `portalAccess` |
| `PATCH` | `/api/students/admissions/:id` | **Admin** | Update admission / sync class fields on student |

**List query:** `page`, `limit`, `status` (`active`  `completed`  `cancelled`), `studentId`

`POST` **body**

```json
{
  "studentId": "<uuid>",
  "registrationId": "<uuid-optional>",
  "admissionDate": "2025-04-15",
  "className": "Class 9",
  "section": "A",
  "stream": "Science",
  "academicYear": "2025-26",
  "admissionNumber": "optional-custom-number",
  "portalAccess": {
    "email": "student@school.local",
    "password": "SecurePass123",
    "name": "Rahul Kumar"
  }
}
```

`portalAccess` is optional; you can call `POST /api/students/:studentId/portal-access` later instead.

---

### 3.5 Transfer certificate (TC)

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/api/students/transfer-certificates` | Student (own) / Admin | List TC metadata (no file path) |
| `POST` | `/api/students/transfer-certificates` | **Admin** | Upload TC file; sets student lifecycle `transferred` |
| `GET` | `/api/students/transfer-certificates/:id/download` | Student (own) / Admin | Download file |

**List query:** `page`, `limit`, `studentId` (admin)

`POST` **multipart fields**

| Field | Required | Description |
|-------|----------|-------------|
| `file` | Yes | PDF or image |
| `studentId` | Yes | Student UUID |
| `issueDate` | Yes | `YYYY-MM-DD` |
| `reason` | No | Text |
| `certificateNumber` | No | Auto-generated if omitted |

---

### 3.6 Leaving certificate (LC)

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/api/students/leaving-certificates` | Student (own) / Admin | List LC metadata |
| `POST` | `/api/students/leaving-certificates` | **Admin** | Upload LC; sets lifecycle `left` |
| `GET` | `/api/students/leaving-certificates/:id/download` | Student (own) / Admin | Download file |

Same as TC, plus optional form field `lastClassAttended`.

---

### 3.7 Student bifurcation (class/section/stream change)

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/api/students/bifurcations/search` | Student (own history) / Admin (all) | Search bifurcation records with student summary |
| `POST` | `/api/students/bifurcations` | **Admin** | Record bifurcation; updates student class/section/stream |

**Search query:** `page`, `limit`, `studentId`, `className`, `section`, `stream`, `fromDate`, `toDate`, `search`

`POST` **body**

```json
{
  "studentId": "<uuid>",
  "fromClass": "Class 9",
  "fromSection": "A",
  "fromStream": "Science",
  "toClass": "Class 10",
  "toSection": "B",
  "toStream": "Commerce",
  "effectiveDate": "2025-07-01",
  "reason": "Stream change request"
}
```

`from*` defaults to current student values if omitted.

---

## 4. Staff / teacher management (`/api/staff`)

**All routes: Admin only** (no staff/teacher login).

---

### 4.1 Staff registration

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/staff` | List staff with filters |
| `POST` | `/api/staff` | Register new staff member |
| `GET` | `/api/staff/:id` | Staff detail |
| `PATCH` | `/api/staff/:id` | Update staff / status |

**List query:** `page`, `limit`, `status` (`active`  `inactive`  `resigned`), `department`, `designation`, `isTeachingStaff` (`true`  `false`), `search`

`POST` **body**

```json
{
  "firstName": "Priya",
  "lastName": "Sharma",
  "designation": "Mathematics Teacher",
  "department": "Senior Secondary",
  "employmentType": "permanent",
  "isTeachingStaff": true,
  "dateOfJoining": "2025-04-01",
  "email": "priya@school.internal",
  "phone": "9876501234",
  "qualifications": "M.Sc Mathematics",
  "subjectsTaught": "Mathematics",
  "baseSalaryPaise": 4500000,
  "staffCode": "optional-custom-code"
}
```

`PATCH`**:** Same fields as POST (all optional) + `status`

**Does:** `staffCode` auto-generates (`STF-...`) if not provided. `isTeachingStaff` distinguishes teachers from non-teaching staff.

---

### 4.2 Staff ledger

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/staff/ledger/entries` | Paginated ledger entries (optional filters + summary when `staffId` set) |
| `POST` | `/api/staff/ledger/entries` | Add ledger entry |
| `GET` | `/api/staff/ledger/entries/:id` | Single entry |
| `GET` | `/api/staff/ledger/:staffId` | Full ledger for one staff + running summary |

**List query:** `page`, `limit`, `staffId`, `category`, `entryType` (`credit`  `debit`), `fromDate`, `toDate`

**Ledger categories:** `opening_balance`, `salary_payment`, `advance`, `deduction`, `bonus`, `reimbursement`, `adjustment`

**Summary (when** `staffId` **provided on list, or on** `GET /ledger/:staffId`**):**

- `totalCreditPaise` — amounts owed/paid to staff  
- `totalDebitPaise` — advances/deductions  
- `balancePaise` — credit minus debit

`POST` **body**

```json
{
  "staffId": "<uuid>",
  "entryDate": "2025-11-01",
  "entryType": "credit",
  "category": "salary_payment",
  "amountPaise": 4500000,
  "referenceNumber": "SAL-2025-11",
  "description": "October salary"
}
```

---

### 4.3 Staff pay slip

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/staff/pay-slips` | List pay slips (with staff name/code) |
| `POST` | `/api/staff/pay-slips` | Upload pay slip file + metadata |
| `GET` | `/api/staff/pay-slips/:id` | Pay slip metadata |
| `GET` | `/api/staff/pay-slips/:id/download` | Download file |

**List query:** `page`, `limit`, `staffId`, `fromDate`, `toDate` (filter by `issueDate`)

`POST` **multipart**

| Field | Required |
|-------|----------|
| `file` | Yes |
| `staffId` | Yes |
| `payPeriodStart` | Yes |
| `payPeriodEnd` | Yes |
| `issueDate` | Yes |
| `slipNumber` | No |
| `grossAmountPaise` | No |
| `netAmountPaise` | No |
| `deductionsPaise` | No |
| `notes` | No |

Files stored under `uploads/payslips/`.

---

## 5. Suggested end-to-end test flow

### A. Admin + student auth

1. `POST /api/auth/sign-in/email` — admin
2. `GET /api/health/me` — confirm `role` contains `admin`
3. `POST /api/students/inquiries` — create inquiry
4. `POST /api/students/inquiries/:id/convert-registration`
5. `PATCH /api/students/registrations/:id` — `{ "status": "approved" }`
6. `PATCH /api/students/registrations/:id` — `{ "status": "approved" }`
7. `POST /api/students/admissions` — include `portalAccess` or use `POST .../portal-access`
8. Sign in as student → `GET /api/students/me`
10. Admin upload TC/LC → student `GET .../download`

### B. Staff (admin only)

1. Sign in as admin
2. `POST /api/staff` — register teacher
3. `POST /api/staff/ledger/entries` — salary credit
4. `GET /api/staff/ledger/:staffId` — verify summary
5. `POST /api/staff/pay-slips` — upload PDF
6. `GET /api/staff/pay-slips/:id/download`

### C. Bifurcation

1. Admin `POST /api/students/bifurcations`
2. Admin `GET /api/students/bifurcations/search?stream=Commerce`
3. Student `GET /api/students/bifurcations/search` — only own rows

---

## 5. Fees management (`/api/fees`)

**Offline only** — no payment gateway. Admin records dues, collects cash/cheque/etc., issues a receipt, and updates balances. Students see **their own** dues, collections, receipts, statement, and alerts when linked via `students.userId`.

### Flow

1. Admin defines **fee heads** (tuition, transport, …)  
2. Admin creates **fee due** for a student (invoice + line items)  
3. Admin **collects** payment → allocates to dues → auto **receipt** + **payment_received** alert  
4. Admin runs **alert generators** for upcoming / overdue dues  
5. Admin uses **outstanding list** for defaulters  

---

### 5.1 Fee heads (master)

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/api/fees/heads` | **Admin** | List fee head codes |
| `POST` | `/api/fees/heads` | **Admin** | Create fee head |
| `PATCH` | `/api/fees/heads/:id` | **Admin** | Update / activate / deactivate |

**`POST` body**

```json
{
  "code": "TUITION",
  "name": "Tuition Fee",
  "description": "Monthly tuition"
}
```

---

### 5.2 Student fee dues

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/api/fees/dues` | Student (own) / Admin | List dues with `outstandingPaise` |
| `GET` | `/api/fees/dues/:id` | Student (own) / Admin | Due + line items |
| `POST` | `/api/fees/dues` | **Admin** | Create due for student |
| `PATCH` | `/api/fees/dues/:id` | **Admin** | Update due date, notes, waive, etc. |

**List query:** `page`, `limit`, `studentId`, `status`, `academicYear`

**Due status:** `pending` | `partial` | `paid` | `overdue` | `waived`

**`POST` body**

```json
{
  "studentId": "<uuid>",
  "academicYear": "2025-26",
  "term": "Term 1",
  "dueDate": "2025-07-15",
  "notes": "Annual term fee",
  "items": [
    { "feeHeadId": "<optional-fee-head-id>", "label": "Tuition", "amountPaise": 2500000 },
    { "label": "Transport", "amountPaise": 500000 }
  ]
}
```

---

### 5.3 Fees collection (manual payment)

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/api/fees/collections` | Student (own) / Admin | List completed collections |
| `GET` | `/api/fees/collections/:id` | Student (own) / Admin | Collection + allocations + receipt |
| `POST` | `/api/fees/collections` | **Admin** | Record payment; updates dues; creates receipt & alert |

**`POST` body**

```json
{
  "studentId": "<uuid>",
  "collectionDate": "2025-07-10",
  "amountPaise": 1500000,
  "paymentMode": "cash",
  "referenceNumber": "optional",
  "remarks": "Part payment at counter",
  "allocations": [
    { "dueId": "<due-uuid>", "amountPaise": 1500000 }
  ]
}
```

**`paymentMode`:** `cash` | `cheque` | `bank_transfer` | `upi_offline` | `other`

**Rules:** Sum of `allocations[].amountPaise` must equal `amountPaise`. Each allocation cannot exceed that due’s outstanding amount.

---

### 5.4 Fees receipt

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/api/fees/receipts` | Student (own) / Admin | List receipts |
| `GET` | `/api/fees/receipts/:id` | Student (own) / Admin | Full receipt (student, allocations, line context) |

Receipts are created automatically when a collection is posted (`receiptNumber` like `RCP-...`).

---

### 5.5 Student statement

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/api/fees/statement?studentId=` | Admin (required `studentId`) / Student (own, omit id) | Summary + timeline |
| `GET` | `/api/fees/statement/:studentId` | Admin / Student (own id only) | Same statement by path |

**Query:** `fromDate`, `toDate` (optional)

**Response includes:** `summary` (`totalDuePaise`, `totalPaidPaise`, `outstandingPaise`), `timeline` (dues + collections), `dues`, `collections`.

---

### 5.6 Student outstanding list

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/api/fees/outstanding` | **Admin** | Students with total outstanding &gt; 0 |

**Query:** `page`, `limit`, `academicYear`, `className`, `section`, `search`, `minOutstandingPaise`

---

### 5.7 Payment alerts & notifications

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/api/fees/alerts` | Student (own) / Admin | List alerts |
| `POST` | `/api/fees/alerts` | **Admin** | Manual notification |
| `PATCH` | `/api/fees/alerts/:id` | Student (own) / Admin | Mark `read` or `dismissed` |
| `POST` | `/api/fees/alerts/generate-overdue` | **Admin** | Create overdue alerts for past-due balances |
| `POST` | `/api/fees/alerts/generate-due-reminders` | **Admin** | Create upcoming due reminders (`?daysAhead=7` default) |

**Alert types:** `due_reminder` | `overdue` | `payment_received` | `custom`  
**Severity:** `info` | `warning` | `critical`  
**Status:** `unread` | `read` | `dismissed`

**Manual alert body**

```json
{
  "studentId": "<uuid>",
  "dueId": "<optional-due-uuid>",
  "alertType": "custom",
  "severity": "warning",
  "title": "Fee counter open",
  "message": "Please visit the school office before 15th."
}
```

---

### Suggested fees test flow (admin)

1. `POST /api/fees/heads` — tuition head  
2. `POST /api/fees/dues` — assign fee to student  
3. `POST /api/fees/alerts/generate-due-reminders`  
4. `POST /api/fees/collections` — partial or full payment  
5. `GET /api/fees/receipts/:id`  
6. `GET /api/fees/statement/:studentId`  
7. `GET /api/fees/outstanding`  
8. Sign in as linked student → `GET /api/fees/alerts?status=unread`

---

## 6. NPM scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled app |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Drizzle Studio |
| `npm run auth:generate` | Regenerate Better Auth Drizzle schema |

---

## 7. Environment variables

See `.env.example`:

- `PORT`, `DATABASE_URL`
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- `CORS_ORIGINS` — comma-separated frontend origins (credentials enabled)
- `UPLOAD_DIR` — default `uploads`

---

## 8. HTTP status codes (typical)

| Code | When |
|------|------|
| `200` | OK |
| `201` | Created |
| `400` | Validation / bad upload |
| `401` | Not authenticated |
| `403` | Wrong role or student accessing another record |
| `404` | Resource not found |
| `500` | Server error |

---

## API summary counts

| Module | Endpoints |
|--------|-----------|
| Health | 2 |
| Auth (Better Auth) | Core sign-up/sign-in/session + admin plugin |
| Students | 28 |
| Staff | 12 |
| Fees | 18 |

For the latest route list, see `src/routes/student.routes.ts`, `src/routes/staff.routes.ts`, and `src/routes/fees.routes.ts`.