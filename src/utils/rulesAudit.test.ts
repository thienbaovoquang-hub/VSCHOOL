import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getCollectionSubscriptionSpecs } from './syncEngine';
import type { UserProfile } from '../types';

const ROOT_DIR = process.cwd();
const RULES_PATH = path.join(ROOT_DIR, 'firestore.rules');
const BLUEPRINT_PATH = path.join(ROOT_DIR, 'firebase-blueprint.json');

function extractMatchBlock(rulesText: string, collectionName: string): string {
  const startRegex = new RegExp(`match\\s+/${collectionName}/\\{[^}]+\\}\\s*\\{`);
  const match = startRegex.exec(rulesText);
  if (!match) return '';

  let depth = 0;
  const startIdx = match.index + match[0].length - 1;
  for (let i = startIdx; i < rulesText.length; i += 1) {
    if (rulesText[i] === '{') depth += 1;
    if (rulesText[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        return rulesText.slice(match.index, i + 1);
      }
    }
  }
  return rulesText.slice(match.index);
}

test('firestore.rules covers every collection in firebase-blueprint.json and syncEngine subscriptions', () => {
  const rulesText = fs.readFileSync(RULES_PATH, 'utf8');
  const blueprint = JSON.parse(fs.readFileSync(BLUEPRINT_PATH, 'utf8')) as {
    firestore: Record<string, unknown>;
  };

  const blueprintCollections = Object.keys(blueprint.firestore).map((p) =>
    p.replace(/^\//, '').split('/')[0]
  );

  const sampleAdmin: UserProfile = {
    id: 'uid-admin',
    email: 'admin@school.vn',
    displayName: 'Admin',
    role: 'admin',
  };
  const subscriptionCollections = getCollectionSubscriptionSpecs(sampleAdmin).map(
    (s) => s.collectionName
  );

  const allRequiredCollections = Array.from(
    new Set([...blueprintCollections, ...subscriptionCollections])
  );

  for (const col of allRequiredCollections) {
    const pattern = new RegExp(`match\\s+/${col}/\\{[^}]+\\}`);
    assert.ok(
      pattern.test(rulesText),
      `Missing match block in firestore.rules for collection "${col}"`
    );
  }
});

test('firestore.rules enforces catch-all deny, blocks unauthenticated rules, and isolates counselingRequests', () => {
  const rulesText = fs.readFileSync(RULES_PATH, 'utf8');

  assert.match(
    rulesText,
    /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;\s*\}/,
    'Missing default deny catch-all match /{document=**}'
  );

  assert.equal(
    /allow\s+(read|write|get|list|create|update|delete)\s*:\s*if\s+true\b/.test(rulesText),
    false,
    'firestore.rules must never allow blanket "if true" access'
  );

  const counselingBlock = extractMatchBlock(rulesText, 'counselingRequests');
  assert.ok(counselingBlock.length > 0, 'counselingRequests match block must exist');
  assert.equal(
    counselingBlock.includes('isAdmin()') || counselingBlock.includes('isPrincipal()'),
    false,
    'counselingRequests must remain confidential from isAdmin() and isPrincipal()'
  );
  assert.ok(
    counselingBlock.includes('isCounselor()'),
    'counselingRequests must allow authorized counselors'
  );
});

test('firestore.rules locks down appConfig from browser writes and supports toggleable DEVELOPMENT_ADMIN_MODE on users', () => {
  const rulesText = fs.readFileSync(RULES_PATH, 'utf8');

  const appConfigBlock = extractMatchBlock(rulesText, 'appConfig');
  assert.ok(appConfigBlock.length > 0, 'appConfig match block must exist');
  assert.ok(
    /allow\s+get:\s*if\s+isSignedIn\(\)/.test(appConfigBlock),
    'appConfig must allow signed-in read via get'
  );
  assert.ok(
    /allow\s+list,\s*create,\s*update,\s*delete:\s*if\s+false;/.test(appConfigBlock),
    'appConfig must forbid all browser list and write operations'
  );

  const usersBlock = extractMatchBlock(rulesText, 'users');
  assert.ok(usersBlock.length > 0, 'users match block must exist');
  assert.ok(
    usersBlock.includes('isDevelopmentAdminMode()'),
    'users rules must evaluate isDevelopmentAdminMode()'
  );
  assert.ok(
    rulesText.includes('hasVerifiedEmail()') &&
      rulesText.includes('request.auth.token.email_verified == true'),
    'rules must guard token.email presence and email_verified == true'
  );
  assert.ok(
    usersBlock.includes('isPrimaryAdminEmail()') &&
      usersBlock.includes('hasClaimableInvite()') &&
      usersBlock.includes("request.resource.data.role == 'admin'") &&
      usersBlock.includes("request.resource.data.role == 'student'"),
    'users rules must preserve primary admin, dev admin, invite claim, and student fallback branches'
  );
});

test('firestore.rules enforces hardened multi-tenant isolation, counseling update locks, and bounded schoolEvents registration', () => {
  const rulesText = fs.readFileSync(RULES_PATH, 'utf8');

  const counselingBlock = extractMatchBlock(rulesText, 'counselingRequests');
  assert.ok(
    counselingBlock.includes("request.resource.data.status in ['pending', 'cancelled']") &&
      counselingBlock.includes("request.resource.data.studentId == resource.data.studentId") &&
      counselingBlock.includes('affectedKeys().hasOnly('),
    'counselingRequests must lock student updates against self-confirming or altering meetingNotes'
  );

  const eventsBlock = extractMatchBlock(rulesText, 'schoolEvents');
  assert.ok(
    eventsBlock.includes('allow create:') &&
      eventsBlock.includes('allow update:') &&
      eventsBlock.includes('registeredUserIds.size() <= 5000') &&
      eventsBlock.includes("'registeredUserIds'"),
    'schoolEvents must separate staff create from bounded user registration update'
  );

  const multiTenantCollections = [
    'teacherProfiles', 'staffMembers', 'classes', 'timetable', 'books', 'bookCopies',
    'borrowTransactions', 'bookReservations', 'leaveRequests', 'counselingRequests',
    'attendanceRecords', 'rooms', 'facilities', 'auditLogs', 'exportHistory',
  ];
  for (const col of multiTenantCollections) {
    const blk = extractMatchBlock(rulesText, col);
    assert.ok(blk.includes('sameSchool(resource.data)'), `${col} must enforce sameSchool on get/delete`);
    assert.ok(blk.includes('canListSchool()'), `${col} must enforce canListSchool on list`);
    assert.ok(blk.includes('incomingSameSchool()'), `${col} must enforce incomingSameSchool on create/update`);
  }
});

test('firestore.rules closes unprovisioned isUserActive bypass, hardens users self-update & invite claims, and includes owner primary admin email', () => {
  const rulesText = fs.readFileSync(RULES_PATH, 'utf8');

  assert.ok(
    rulesText.includes('nguyenthithanhtruc10112018@gmail.com'),
    'isPrimaryAdminEmail() must include runtime owner email'
  );
  const isUserActiveMatch = /function isUserActive\(\)\s*\{[\s\S]*?\n\s*\}/.exec(rulesText);
  assert.ok(isUserActiveMatch, 'isUserActive() function must exist');
  assert.ok(
    isUserActiveMatch[0].includes('userDocExists() && isUserDocActive(userDocData())') &&
      !isUserActiveMatch[0].includes('!userDocExists() ||'),
    'isUserActive() must require an active users/{uid} doc rather than allowing any unprovisioned account'
  );

  const usersBlock = extractMatchBlock(rulesText, 'users');
  assert.ok(
    usersBlock.includes('isValidUserPayload(request.resource.data, userId)') &&
      usersBlock.includes('normalizedSchoolId(request.resource.data) == normalizedSchoolId(claimableInviteData())') &&
      usersBlock.includes('normalizedSecondaryRoles(request.resource.data) == normalizedSecondaryRoles(claimableInviteData())') &&
      usersBlock.includes('request.resource.data.diff(resource.data).affectedKeys().hasOnly(['),
    'users rules must validate user payload, lock invite secondaryRoles, normalize null/empty legacy fields, and constrain self-update keys'
  );
});

