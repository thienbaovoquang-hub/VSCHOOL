# Security Specification for SchoolHub

## 1. Data Invariants & Privacy Boundaries
- **Single Online Source of Truth & Multi-School Isolation (`schoolId`)**: Every business record stored in Cloud Firestore carries `schoolId` (defaulting to `schoolhub_main` for legacy records) and optimistic `version >= 1`. Cross-school reads and writes are denied by `sameSchool(resource.data)` and `incomingSameSchool()`.
- `User` (`users/{userId}`): Supports `role`, optional `preDevRole` (non-destructively preserving original role before development elevation), optional `secondaryRoles` (`list`, max 7 roles), and `schoolId`. When `isDevelopmentAdminMode()` is `true`, verified users (`request.auth.token.email_verified == true`) may self-provision or sync `role == 'admin'`, `status == 'active'`. When `DEVELOPMENT_ADMIN_MODE` is `false` (official RBAC mode), only `isPrimaryAdminEmail()`, a one-time unclaimed `userInvites` claim matching verified email, `'student'` default self-signup, or a verified `admin` can set roles; public listing of other users' PII (`email`, `phone`) remains prohibited for non-staff roles (`isUser(userId)` for students).
- `AppRuntimeConfig` (`appConfig/{configId}`): Stores runtime flags such as `DEVELOPMENT_ADMIN_MODE`. Browser/client SDKs may only `get` (`isSignedIn()`), and **all client `list`, `create`, `update`, and `delete` writes are unconditionally denied (`if false;`)**. Changes must be applied via server environment (`DEVELOPMENT_ADMIN_MODE=false`) and/or Firebase Console / Admin SDK (`appConfig/runtime`).
- `UserInvite` (`userInvites/{inviteId}`): Pre-provisioned role/class assignment indexed by `INV_<normalized_email>`. Only Admin creates or deletes invites; a signed-in user with `email_verified == true` may `get` and one-time claim (`claimedByUid == request.auth.uid`) ONLY the invite matching their own verified email (`emailLower == request.auth.token.email.lower()`) without changing `role`, `schoolId`, or `emailLower`.
- `ExternalDataset` (`externalDatasets/{datasetId}`): Reference/KPI datasets imported for AI Analytics; readable by active school users (`sameSchool`), writable by Admin, Principal, Teachers, Librarians, or Staff, and deletable by Admin/Principal.
- `StudentProfile`: Requires valid `studentCode` and `fullName`. Only Admin, Principal (BGH), or Homeroom Teachers can create/update student records; only Admin can delete. Students can only read their own record.
- `TeacherProfile` / `StaffMember` / `AcademicYear` / `SchoolClass` / `ClassPlacement` / `TeachingAssignment` / `TimetableEntry`: Managed by Admin or Principal (BGH); `teacherCode` is NOT required (teachers are identified by `id` / `fullName` / `email`). Readable by authenticated school users.
- `Book` / `BookCopy` / `InventoryAudit` / `BorrowTransaction` / `BookReservation`: Managed by Admin or Librarian (with Principal read/oversight); students/borrowers can create/read their own reservations and view their own borrow history without altering borrow/return status directly. Atomic Firestore transactions enforce copy availability and counter integrity.
- `LibraryRenewalRequest`: Authenticated borrowers can create/read their own renewal requests (`borrowerId == request.auth.uid`) in `'pending'` status; only Librarian or Admin can approve/reject.
- `LibraryTransactionHistoryEntry`: Immutable audit log for due-date edits & renewals (`allow update, delete: if false`); created only by Librarian, Admin, or Principal with mandatory non-empty `reason`.
- `RuleDocument` / `RuleVersion` / `RuleCategory` / `RuleCriterion`: Readable by authenticated school users; drafted by Principal/Admin/Homeroom Teacher; final approval (`status: 'approved'` / `'active'`) and archival restricted to Admin or Principal (BGH).
- `EmulationRecord`: Teachers/Staff/Principal/Admin can create/log events; only Principal/Admin (or Homeroom Teacher for verification) can approve/cancel records. Records marked `isSensitive == true` are hidden from non-staff/non-owner reads where applicable.
- `EmulationAppeal`: Students can create appeals for their own records (`studentId == request.auth.uid`) in `'submitted'` status; only Principal/Admin/Homeroom Teacher can review and resolve.
- `EmulationPeriod` / `EmulationSnapshot` / `EmulationTitleConfig`: Managed by Principal or Admin. `EmulationSnapshot` is immutable once created (`allow update: if false`, `allow delete: if isAdmin()`).
- `Competition` / `CompetitionCriterion` / `CompetitionParticipant` / `CompetitionScore` / `CompetitionAward`: Readable by authenticated school users; managed/scored by Admin, Principal, or Teachers.
- `ScoreTransferRecord`: Anti-double-count transfer ledger; created only by Principal or Admin with valid `sourceId` and `emulationRecordId`. Updates restricted to Admin or Principal reverting `syncStatus` to `'reverted'`.
- `CounselingRequest`: **Strictly Confidential**. ONLY the requesting student (`resource.data.studentId == request.auth.uid`) and users holding the `counselor` role can read or update consultation records. **Admin, Principal (BGH), Teachers, Librarians, and Staff MUST NOT access private counseling records unless explicitly holding the `counselor` role.**
- `SystemSettings`: Admin manages all fields including `customPermissions`; Principal (BGH) may update operational `libraryPolicy` / `emulationPolicy` without modifying `customPermissions`.

## 2. Dirty Dozen Payloads (Designed to test boundaries)
1. Impersonate `admin` or `principal` role via `role` or `secondaryRoles` on user self-registration (`users/{uid}`) when `DEVELOPMENT_ADMIN_MODE` is `false`, or when `email_verified == false`, or forge an unclaimed `userInvites` doc for another email.
2. Mutate `appConfig/runtime` (`DEVELOPMENT_ADMIN_MODE`) from any browser client SDK or `POST/PUT/PATCH /api/system/auth-mode` request (must return Firestore `PERMISSION_DENIED` and HTTP `403`).
3. Inject 500KB string into `studentCode`, `reason`, or rule `title`, or write a negative/oversized `version`.
4. Cross-school tenant breach: user in `school_b` attempts to read or write `studentProfiles` or `academicRecords` belonging to `schoolhub_main`.
5. Read or delete another student's `CounselingRequest` as `principal` or `admin` (without `counselor` role).
6. Arbitrarily alter `BorrowTransaction` status from `'borrowed'` to `'returned'` or edit `dueDate` as a `student`.
7. Read all `users` PII (`email`, `phone`) or `userInvites` list as a `student`.
8. Modify immutable `LibraryTransactionHistoryEntry` or `EmulationSnapshot` after creation.
9. Approve own `LibraryRenewalRequest` (`status: 'approved'`) from a `student` account.
10. Directly write `EmulationRecord` with `status: 'recorded'` or overwrite `pointsApplied` as a `student`.
11. Create duplicate/forged `ScoreTransferRecord` or `ExternalDataset` as a `student`.
12. Escalate `customPermissions` in `systemSettings/{schoolId}` from a `principal` account, or re-claim an already-claimed `userInvites` doc (`claimedByUid != ''`).

## 3. Production Turn-Off Procedure (`DEVELOPMENT_ADMIN_MODE = false`)
1. Set `DEVELOPMENT_ADMIN_MODE=false` in the server deployment environment and restart the server (`GET /api/system/auth-mode` will immediately report `developmentAdminMode: false`).
2. Create or update Firestore document `appConfig/runtime` with `{ DEVELOPMENT_ADMIN_MODE: false }` via Firebase Console or Admin SDK so `isDevelopmentAdminMode()` in `firestore.rules` immediately evaluates to `false` and restores official `student` / `userInvites` / `isPrimaryAdminEmail()` onboarding.
3. Optionally review any test user accounts in `users/{uid}` whose `preDevRole` preserves their prior non-admin role.

## 4. Verification
Verified against Firestore Security Rules (`firestore.rules`) with default-deny catch-all, immutable `appConfig/{configId}`, `isDevelopmentAdminMode()` verified-email gate, multi-role `hasAnyRole()`, `schoolId` isolation, `userInvites` verified-email one-time claim gate, `counselor`-strict counseling isolation, verified-email admin check (`email_verified == true`), ID format validation (`isValidId()`), per-field size/type validation, `@firebase/eslint-plugin-security-rules` static audit, `devAdminMode.test.ts`, and `rulesAudit.test.ts` blueprint-to-rules coverage check.

