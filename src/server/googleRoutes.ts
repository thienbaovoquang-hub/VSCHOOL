import crypto from 'node:crypto';
import type { Express, Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { extractStructuredGoogleDoc, diffDocTexts } from '../utils/googleSync/docsParser.ts';
import { classifyGoogleApiError } from '../utils/googleSync/errorClassifier.ts';
import { extractRangeHeaderAndRows, parseRangeStartRow } from '../utils/googleSync/rangeUtils.ts';
import { parseRuleClausesLocally } from '../utils/emulationRules.ts';
import type {
  GoogleSheetValidationColumnSpec,
  GoogleSheetValidationInspection,
  GoogleSyncErrorCode,
} from '../types/index.ts';

function normalizeHeaderToken(header: string): string {
  return (header || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\*+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface EphemeralDelegateSession {
  sessionId: string;
  accessToken: string;
  email: string;
  expiresAt: number;
}

interface DriveWebhookEvent {
  id: string;
  channelId: string;
  resourceId: string;
  resourceState: string;
  messageNumber: string;
  receivedAt: string;
}

// Strict in-memory RAM storage only (never persisted to disk/database)
const delegatedSessions = new Map<string, EphemeralDelegateSession>();
const seenWebhookMessageKeys = new Set<string>();
const webhookEventQueue: DriveWebhookEvent[] = [];

function cleanupExpiredDelegates() {
  const now = Date.now();
  for (const [key, val] of delegatedSessions.entries()) {
    if (val.expiresAt <= now) {
      delegatedSessions.delete(key);
    }
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const sessionId = req.headers['x-delegate-session'];
  if (typeof sessionId === 'string' && sessionId.trim()) {
    cleanupExpiredDelegates();
    const sess = delegatedSessions.get(sessionId.trim());
    if (sess && sess.expiresAt > Date.now()) {
      return sess.accessToken;
    }
  }
  return null;
}

function getWebhookReadiness(): {
  webhookCapable: boolean;
  appUrl: string;
  webhookUrl: string | null;
  webhookMessage: string;
} {
  const rawUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  const isRealHttps =
    rawUrl.startsWith('https://') &&
    !rawUrl.includes('MY_APP_URL') &&
    !rawUrl.includes('localhost') &&
    !rawUrl.includes('127.0.0.1');

  if (isRealHttps) {
    return {
      webhookCapable: true,
      appUrl: rawUrl,
      webhookUrl: `${rawUrl}/api/google/drive-webhook`,
      webhookMessage: `Sẵn sàng nhận Google Drive Webhook HTTPS tại ${rawUrl}/api/google/drive-webhook`,
    };
  }
  return {
    webhookCapable: false,
    appUrl: rawUrl || 'http://localhost:3000',
    webhookUrl: null,
    webhookMessage:
      'Môi trường hiện tại không phải public HTTPS (APP_URL đang là local/chưa cấu hình). Google Drive Push Webhook chỉ hoạt động khi triển khai trên domain HTTPS công khai; hiện tại dùng cơ chế kiểm tra Changes API định kỳ an toàn.',
  };
}

async function googleApiJson(
  url: string,
  token: string,
  init?: RequestInit,
  errorContext?: { serviceLabel?: string; sheetName?: string }
): Promise<{
  ok: boolean;
  status: number;
  data: any;
  errorMessage?: string;
  errorCode?: GoogleSyncErrorCode;
}> {
  const resp = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const text = await resp.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { rawText: text };
  }

  if (!resp.ok) {
    const classified = classifyGoogleApiError(resp.status, text, errorContext);
    return {
      ok: false,
      status: resp.status,
      data,
      errorMessage: classified.friendlyMessage,
      errorCode: classified.errorCode,
    };
  }

  return { ok: true, status: resp.status, data };
}

function columnLetter(colIndexZeroBased: number): string {
  let n = colIndexZeroBased + 1;
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result || 'A';
}

function buildSetDataValidationRequests(params: {
  sheetId: number;
  headers: string[];
  validationColumns: GoogleSheetValidationColumnSpec[];
  headerRowIndexZeroBased: number;
  endRowIndex: number;
}): {
  requests: any[];
  matchedHeaders: string[];
  skippedHeaders: string[];
} {
  const { sheetId, headers, validationColumns, headerRowIndexZeroBased, endRowIndex } = params;
  const requests: any[] = [];
  const matchedHeaders: string[] = [];
  const skippedHeaders: string[] = [];

  for (const spec of validationColumns) {
    const cleanValues = Array.from(
      new Set((spec.values || []).map((v) => String(v ?? '').trim()).filter(Boolean))
    ).slice(0, 500);
    if (cleanValues.length === 0) {
      skippedHeaders.push(spec.header);
      continue;
    }

    const specNorm = normalizeHeaderToken(spec.header);
    const keyNorm = normalizeHeaderToken(spec.fieldKey);
    const colIdx = headers.findIndex((h) => {
      const hn = normalizeHeaderToken(h);
      return Boolean(hn) && (hn === specNorm || (keyNorm && hn === keyNorm));
    });

    if (colIdx < 0) {
      skippedHeaders.push(spec.header);
      continue;
    }

    matchedHeaders.push(headers[colIdx]);
    requests.push({
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: headerRowIndexZeroBased + 1,
          endRowIndex: Math.max(endRowIndex, headerRowIndexZeroBased + 200),
          startColumnIndex: colIdx,
          endColumnIndex: colIdx + 1,
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: cleanValues.map((v) => ({ userEnteredValue: v })),
          },
          inputMessage:
            spec.helpText || `Chọn giá trị hợp lệ theo danh mục SchoolHub cho cột "${headers[colIdx]}".`,
          strict: spec.strict !== false,
          showCustomUi: true,
        },
      },
    });
  }

  return { requests, matchedHeaders, skippedHeaders };
}

interface DocSectionInput {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: string[][];
}

async function writeSectionsToGoogleDoc(
  documentId: string,
  token: string,
  sections: DocSectionInput[],
  clearExisting: boolean
): Promise<{ ok: boolean; status: number; errorMessage?: string }> {
  // 1. Inspect current doc to clear existing content cleanly if replacing
  const inspectRes = await googleApiJson(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
    token
  );
  if (!inspectRes.ok) return inspectRes;

  const contentBlocks = Array.isArray(inspectRes.data?.body?.content)
    ? inspectRes.data.body.content
    : [];
  const lastBlock = contentBlocks[contentBlocks.length - 1];
  const docEndIndex = Number(lastBlock?.endIndex || 1);

  if (clearExisting && docEndIndex > 2) {
    const clearRes = await googleApiJson(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: [
            {
              deleteContentRange: {
                range: { startIndex: 1, endIndex: docEndIndex - 1 },
              },
            },
          ],
        }),
      }
    );
    if (!clearRes.ok) return clearRes;
  }

  // 2. Write each section sequentially so tables stay paired directly beneath their headings
  for (const sec of sections) {
    const latestBeforeText = await googleApiJson(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
      token
    );
    if (!latestBeforeText.ok) return latestBeforeText;

    const existingBlocks = Array.isArray(latestBeforeText.data?.body?.content)
      ? latestBeforeText.data.body.content
      : [];
    let cursor = Math.max(
      1,
      Number(existingBlocks[existingBlocks.length - 1]?.endIndex || 1) - 1
    );

    const requests: any[] = [];

    if (sec.heading) {
      const text = `${sec.heading.trim()}\n`;
      const start = cursor;
      const end = start + text.length;
      requests.push({ insertText: { location: { index: start }, text } });
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end - 1 },
          paragraphStyle: { namedStyleType: 'HEADING_2' },
          fields: 'namedStyleType',
        },
      });
      cursor = end;
    }

    for (const p of sec.paragraphs || []) {
      const clean = String(p || '').trim();
      if (!clean) continue;
      const text = `${clean}\n`;
      requests.push({ insertText: { location: { index: cursor }, text } });
      cursor += text.length;
    }

    if (sec.bullets && sec.bullets.length > 0) {
      const bulletStart = cursor;
      for (const b of sec.bullets) {
        const clean = String(b || '').trim();
        if (!clean) continue;
        const text = `${clean}\n`;
        requests.push({ insertText: { location: { index: cursor }, text } });
        cursor += text.length;
      }
      if (cursor > bulletStart) {
        requests.push({
          createParagraphBullets: {
            range: { startIndex: bulletStart, endIndex: cursor - 1 },
            bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
          },
        });
      }
    }

    if (requests.length > 0) {
      const batchRes = await googleApiJson(
        `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
        token,
        { method: 'POST', body: JSON.stringify({ requests }) }
      );
      if (!batchRes.ok) return batchRes;
    }

    if (sec.table && sec.table.length > 0 && sec.table[0].length > 0) {
      const numRows = Math.min(sec.table.length, 60);
      const numCols = Math.min(Math.max(...sec.table.map((r) => r.length)), 12);
      if (numRows > 0 && numCols > 0) {
        const latestDoc = await googleApiJson(
          `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
          token
        );
        if (!latestDoc.ok) return latestDoc;

        const blocks = latestDoc.data?.body?.content || [];
        const endIdx = Math.max(1, Number(blocks[blocks.length - 1]?.endIndex || 1) - 1);

        const insertTbl = await googleApiJson(
          `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
          token,
          {
            method: 'POST',
            body: JSON.stringify({
              requests: [
                {
                  insertTable: {
                    rows: numRows,
                    columns: numCols,
                    location: { index: endIdx },
                  },
                },
              ],
            }),
          }
        );
        if (!insertTbl.ok) return insertTbl;

        const docWithTbl = await googleApiJson(
          `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
          token
        );
        if (!docWithTbl.ok) return docWithTbl;

        const tblBlocks = (docWithTbl.data?.body?.content || []).filter((b: any) =>
          Boolean(b?.table)
        );
        const targetTable = tblBlocks[tblBlocks.length - 1]?.table;
        if (targetTable?.tableRows) {
          const cellInserts: Array<{ index: number; text: string }> = [];
          for (let r = 0; r < numRows; r++) {
            const rowMeta = targetTable.tableRows[r];
            if (!rowMeta) continue;
            for (let c = 0; c < numCols; c++) {
              const val = String(sec.table[r]?.[c] ?? '').trim();
              if (!val) continue;
              const cell = rowMeta.tableCells?.[c];
              const cellStart = cell?.content?.[0]?.startIndex;
              if (typeof cellStart === 'number') {
                cellInserts.push({ index: cellStart, text: val });
              }
            }
          }

          cellInserts.sort((a, b) => b.index - a.index);
          if (cellInserts.length > 0) {
            await googleApiJson(
              `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
              token,
              {
                method: 'POST',
                body: JSON.stringify({
                  requests: cellInserts.map((ci) => ({
                    insertText: { location: { index: ci.index }, text: ci.text },
                  })),
                }),
              }
            );
          }
        }
      }
    }
  }

  return { ok: true, status: 200, errorMessage: undefined };
}

export function registerGoogleWorkspaceRoutes(
  app: Express,
  getGeminiClient: () => GoogleGenAI | null,
  geminiModel: string
) {
  // 1. Ephemeral RAM-only session delegation (for active-tab/server webhook sync)
  app.post('/api/google/session/delegate', (req: Request, res: Response) => {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: 'Thiếu Bearer access token.' });
      return;
    }
    cleanupExpiredDelegates();
    const sessionId = crypto.randomUUID();
    const ttlSec = Math.min(Math.max(Number(req.body?.expiresInSeconds || 3300), 120), 3600);
    delegatedSessions.set(sessionId, {
      sessionId,
      accessToken: token,
      email: String(req.body?.email || ''),
      expiresAt: Date.now() + ttlSec * 1000,
    });
    res.json({ sessionId, expiresAt: new Date(Date.now() + ttlSec * 1000).toISOString() });
  });

  app.delete('/api/google/session/delegate', (req: Request, res: Response) => {
    const sessionId = String(req.body?.sessionId || req.headers['x-delegate-session'] || '');
    if (sessionId) {
      delegatedSessions.delete(sessionId);
    }
    res.json({ ok: true });
  });

  // 2. Test Connection & Token Scopes
  app.get('/api/google/status', async (req: Request, res: Response) => {
    const token = extractToken(req);
    const readiness = getWebhookReadiness();
    if (!token) {
      res.status(401).json({
        valid: false,
        scopes: [],
        ...readiness,
        error: 'Chưa có Google OAuth token trong phiên hiện tại.',
      });
      return;
    }

    try {
      const [tokenInfoResp, aboutRes] = await Promise.all([
        fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`),
        googleApiJson(
          'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink)',
          token
        ),
      ]);

      const tokenInfo = tokenInfoResp.ok ? await tokenInfoResp.json().catch(() => ({})) : {};
      if (!tokenInfoResp.ok && !aboutRes.ok) {
        res.status(401).json({
          valid: false,
          scopes: [],
          ...readiness,
          error: aboutRes.errorMessage || 'Google OAuth token đã hết hạn hoặc không hợp lệ.',
        });
        return;
      }

      const scopes = typeof tokenInfo.scope === 'string'
        ? tokenInfo.scope.split(/\s+/).filter(Boolean)
        : [];
      const driveUser = aboutRes.ok ? aboutRes.data?.user : null;

      res.json({
        valid: true,
        email: driveUser?.emailAddress || tokenInfo.email || '',
        displayName: driveUser?.displayName || tokenInfo.email || '',
        photoUrl: driveUser?.photoLink || undefined,
        scopes,
        expiresIn: tokenInfo.expires_in ? Number(tokenInfo.expires_in) : undefined,
        ...readiness,
      });
    } catch (error) {
      res.status(502).json({
        valid: false,
        scopes: [],
        ...readiness,
        error: error instanceof Error ? error.message : 'Không thể kiểm tra kết nối Google API.',
      });
    }
  });

  // 3. Drive File Metadata & Permissions Verification
  app.get('/api/google/files/:fileId/metadata', async (req: Request, res: Response) => {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ errorCode: 'TOKEN_EXPIRED', error: 'Vui lòng kết nối Google Workspace trước.' });
      return;
    }
    const { fileId } = req.params;
    const result = await googleApiJson(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,webViewLink,modifiedTime,trashed,owners(displayName,emailAddress),capabilities(canEdit,canReadRevisions,canShare)&supportsAllDrives=true`,
      token,
      undefined,
      { serviceLabel: 'Google Drive API' }
    );

    if (!result.ok) {
      res.status(result.status).json({ error: result.errorMessage, errorCode: result.errorCode });
      return;
    }

    const d = result.data;
    const canEdit = Boolean(d?.capabilities?.canEdit);
    const trashed = Boolean(d?.trashed);
    const permissionLevel = trashed
      ? 'trashed'
      : canEdit
      ? 'read_write'
      : 'read_only';

    res.json({
      id: d.id,
      name: d.name,
      mimeType: d.mimeType,
      webViewLink: d.webViewLink,
      modifiedTime: d.modifiedTime,
      trashed,
      ownerName: d.owners?.[0]?.displayName || '',
      ownerEmail: d.owners?.[0]?.emailAddress || '',
      canEdit,
      permissionLevel,
    });
  });

  // 4. Google Sheets: Inspect Tabs + Preview Range + Existing DataValidations
  app.get('/api/google/sheets/:spreadsheetId/inspect', async (req: Request, res: Response) => {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ errorCode: 'TOKEN_EXPIRED', error: 'Vui lòng kết nối Google Workspace trước.' });
      return;
    }
    const { spreadsheetId } = req.params;
    const requestedSheet = typeof req.query.sheetName === 'string' ? req.query.sheetName.trim() : '';
    const headerRow = Math.max(1, Number(req.query.headerRow || 1));
    const previewLimit = Math.min(500, Math.max(25, Number(req.query.previewLimit || 200)));

    const metaRes = await googleApiJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets(properties(sheetId,title,gridProperties),protectedRanges)`,
      token,
      undefined,
      { serviceLabel: 'Google Sheets API', sheetName: requestedSheet || undefined }
    );

    if (!metaRes.ok) {
      res.status(metaRes.status).json({ error: metaRes.errorMessage, errorCode: metaRes.errorCode });
      return;
    }

    const rawSheets = Array.isArray(metaRes.data?.sheets) ? metaRes.data.sheets : [];
    const sheets = rawSheets.map((s: any) => ({
      sheetId: Number(s?.properties?.sheetId || 0),
      title: String(s?.properties?.title || 'Trang'),
      rowCount: Number(s?.properties?.gridProperties?.rowCount || 0),
      columnCount: Number(s?.properties?.gridProperties?.columnCount || 0),
      protectedRangesCount: Array.isArray(s?.protectedRanges) ? s.protectedRanges.length : 0,
    }));

    const matchedSheetObj = requestedSheet
      ? sheets.find((s: any) => s.title === requestedSheet)
      : sheets[0];
    const requestedSheetMissing = Boolean(requestedSheet && !matchedSheetObj);
    const targetSheetMeta = matchedSheetObj || sheets[0];
    const targetSheet = targetSheetMeta?.title;

    let previewHeaders: string[] = [];
    let previewRows: unknown[][] = [];
    let formulaRows: unknown[][] = [];
    let validations: GoogleSheetValidationInspection | undefined;

    if (targetSheet) {
      const escapedSheet = targetSheet.replace(/'/g, "''");
      const safeRange = `'${escapedSheet}'!A1:ZZ${headerRow + previewLimit}`;
      const sampleValidationRange = `'${escapedSheet}'!A${headerRow + 1}:ZZ${headerRow + 1}`;

      const [valRes, formulaRes, ruleMetaRes] = await Promise.all([
        googleApiJson(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(safeRange)}?valueRenderOption=FORMATTED_VALUE`,
          token,
          undefined,
          { serviceLabel: 'Google Sheets API', sheetName: targetSheet }
        ),
        googleApiJson(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(safeRange)}?valueRenderOption=FORMULA`,
          token,
          undefined,
          { serviceLabel: 'Google Sheets API', sheetName: targetSheet }
        ),
        googleApiJson(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?ranges=${encodeURIComponent(sampleValidationRange)}&fields=sheets(properties(sheetId,title),data(rowData(values(dataValidation))))`,
          token,
          undefined,
          { serviceLabel: 'Google Sheets API', sheetName: targetSheet }
        ),
      ]);

      if (!valRes.ok) {
        res.status(valRes.status).json({ error: valRes.errorMessage, errorCode: valRes.errorCode });
        return;
      }

      if (Array.isArray(valRes.data?.values)) {
        const extracted = extractRangeHeaderAndRows({
          allValues: valRes.data.values as unknown[][],
          formulaValues: formulaRes.ok && Array.isArray(formulaRes.data?.values)
            ? (formulaRes.data.values as unknown[][])
            : [],
          headerRow,
          rangeUsed: safeRange,
        });
        previewHeaders = extracted.headers;
        previewRows = extracted.rawRows;
        formulaRows = extracted.formulaRows;
      }

      const validationRowVals =
        ruleMetaRes.ok &&
        Array.isArray(ruleMetaRes.data?.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values)
          ? (ruleMetaRes.data.sheets[0].data[0].rowData[0].values as any[])
          : [];

      if (previewHeaders.length > 0) {
        validations = {
          spreadsheetId: metaRes.data.spreadsheetId,
          sheetName: targetSheet,
          sheetId: Number(targetSheetMeta?.sheetId || 0),
          columns: previewHeaders.map((header, colIndex) => {
            const dv = validationRowVals[colIndex]?.dataValidation;
            const ruleType = dv?.condition?.type ? String(dv.condition.type) : undefined;
            const currentValues = Array.isArray(dv?.condition?.values)
              ? dv.condition.values
                  .map((v: any) => String(v?.userEnteredValue ?? '').trim())
                  .filter(Boolean)
              : undefined;
            return {
              colIndex,
              header,
              hasValidation: Boolean(dv?.condition),
              ruleType,
              currentValues,
            };
          }),
        };
      }
    }

    res.json({
      spreadsheetId: metaRes.data.spreadsheetId,
      title: metaRes.data?.properties?.title || 'Google Spreadsheet',
      spreadsheetUrl: metaRes.data.spreadsheetUrl,
      selectedSheetName: targetSheet || '',
      requestedSheetMissing,
      sheets,
      previewHeaders,
      previewRows,
      formulaRows,
      validations,
    });
  });

  // 5. Google Sheets: Verify Tab Existence + Read Full Range (values + formulas)
  app.post('/api/google/sheets/:spreadsheetId/read', async (req: Request, res: Response) => {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ errorCode: 'TOKEN_EXPIRED', error: 'Vui lòng kết nối Google Workspace trước.' });
      return;
    }
    const { spreadsheetId } = req.params;
    const requestedSheet = String(req.body?.sheetName || '').trim();
    const headerRow = Math.max(1, Number(req.body?.headerRow || 1));
    const customRange = String(req.body?.dataRange || '').trim();

    if (!requestedSheet) {
      res.status(400).json({ errorCode: 'SHEET_NOT_FOUND', error: 'Thiếu tên sheet tab cần đọc.' });
      return;
    }

    // Step 1: Verify spreadsheet access & exact tab existence via spreadsheets.get
    const metaRes = await googleApiJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,properties.title,sheets(properties(sheetId,title))`,
      token,
      undefined,
      { serviceLabel: 'Google Sheets API', sheetName: requestedSheet }
    );

    if (!metaRes.ok) {
      res.status(metaRes.status).json({
        errorCode: metaRes.errorCode,
        error: metaRes.errorMessage,
      });
      return;
    }

    const availableSheets: string[] = Array.isArray(metaRes.data?.sheets)
      ? metaRes.data.sheets.map((s: any) => String(s?.properties?.title || '')).filter(Boolean)
      : [];

    const exactSheet = availableSheets.find((t) => t === requestedSheet)
      || availableSheets.find((t) => t.toLowerCase() === requestedSheet.toLowerCase());

    if (!exactSheet) {
      res.status(404).json({
        errorCode: 'SHEET_NOT_FOUND' as GoogleSyncErrorCode,
        error: `Không tìm thấy tab "${requestedSheet}" trong bảng tính "${metaRes.data?.properties?.title || spreadsheetId}". Các tab hiện có: ${availableSheets.join(', ') || '(trống)'}.`,
        availableSheets,
      });
      return;
    }

    const escapedExactSheet = exactSheet.replace(/'/g, "''");
    const fullRange = customRange
      ? customRange.includes('!')
        ? customRange
        : `'${escapedExactSheet}'!${customRange}`
      : `'${escapedExactSheet}'!A1:ZZ5000`;
    const rangeStartRow = parseRangeStartRow(fullRange);
    const needsSeparateHeaderFetch = rangeStartRow > headerRow;
    const headerFallbackRange = `'${escapedExactSheet}'!A${headerRow}:ZZ${headerRow}`;
    const rangesQuery = needsSeparateHeaderFetch
      ? `ranges=${encodeURIComponent(fullRange)}&ranges=${encodeURIComponent(headerFallbackRange)}`
      : `ranges=${encodeURIComponent(fullRange)}`;

    // Step 2: Read formatted values + formulas via official values:batchGet
    const [valRes, formulaRes] = await Promise.all([
      googleApiJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${rangesQuery}&valueRenderOption=FORMATTED_VALUE`,
        token,
        undefined,
        { serviceLabel: 'Google Sheets API', sheetName: exactSheet }
      ),
      googleApiJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?ranges=${encodeURIComponent(fullRange)}&valueRenderOption=FORMULA`,
        token,
        undefined,
        { serviceLabel: 'Google Sheets API', sheetName: exactSheet }
      ),
    ]);

    if (!valRes.ok) {
      res.status(valRes.status).json({
        errorCode: valRes.errorCode,
        error: valRes.errorMessage,
        availableSheets,
      });
      return;
    }

    const allVals = Array.isArray(valRes.data?.valueRanges?.[0]?.values)
      ? (valRes.data.valueRanges[0].values as unknown[][])
      : [];
    const formulaAllVals = Array.isArray(formulaRes.data?.valueRanges?.[0]?.values)
      ? (formulaRes.data.valueRanges[0].values as unknown[][])
      : [];
    const explicitHeaderRowValues =
      needsSeparateHeaderFetch && Array.isArray(valRes.data?.valueRanges?.[1]?.values?.[0])
        ? (valRes.data.valueRanges[1].values[0] as unknown[])
        : undefined;

    const extracted = extractRangeHeaderAndRows({
      allValues: allVals,
      formulaValues: formulaAllVals,
      headerRow,
      rangeUsed: fullRange,
      explicitHeaderRowValues,
    });
    const headers = extracted.headers;
    const rawRows = extracted.rawRows;
    const formulaVals = extracted.formulaRows;

    const isEmptySheet = headers.every((h) => !h) && rawRows.length === 0;

    res.json({
      sheetName: exactSheet,
      availableSheets,
      headers,
      rawRows,
      formulaRows: formulaVals,
      totalRawRows: rawRows.length,
      isEmptySheet,
    });
  });

  // 6. Google Sheets: Write / Update Existing Tab
  app.post('/api/google/sheets/:spreadsheetId/write', async (req: Request, res: Response) => {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ errorCode: 'TOKEN_EXPIRED', error: 'Vui lòng kết nối Google Workspace trước.' });
      return;
    }
    const { spreadsheetId } = req.params;
    const sheetName = String(req.body?.sheetName || '').trim();
    const headers = Array.isArray(req.body?.headers) ? (req.body.headers as string[]) : [];
    const rows = Array.isArray(req.body?.rows) ? (req.body.rows as any[][]) : [];
    const startRow = Math.max(1, Number(req.body?.startRow || 1));

    if (!sheetName || headers.length === 0) {
      res.status(400).json({ errorCode: 'INVALID_HEADERS', error: 'Thiếu sheetName hoặc headers khi ghi Google Sheets.' });
      return;
    }

    const values = [headers, ...rows];
    const lastCol = columnLetter(Math.max(headers.length - 1, 0));
    const endRow = startRow + values.length - 1;
    const targetRange = `'${sheetName.replace(/'/g, "''")}'!A${startRow}:${lastCol}${endRow}`;

    const writeRes = await googleApiJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(targetRange)}?valueInputOption=USER_ENTERED`,
      token,
      {
        method: 'PUT',
        body: JSON.stringify({
          range: targetRange,
          majorDimension: 'ROWS',
          values,
        }),
      },
      { serviceLabel: 'Google Sheets API', sheetName }
    );

    if (!writeRes.ok) {
      res.status(writeRes.status).json({ error: writeRes.errorMessage, errorCode: writeRes.errorCode });
      return;
    }

    res.json({
      updatedCells: Number(writeRes.data?.updatedCells || 0),
      updatedRows: Number(writeRes.data?.updatedRows || values.length),
      range: targetRange,
    });
  });

  // 7. Google Sheets: Create New Formatted Spreadsheet + Real setDataValidation
  app.post('/api/google/sheets/create', async (req: Request, res: Response) => {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ errorCode: 'TOKEN_EXPIRED', error: 'Vui lòng kết nối Google Workspace trước.' });
      return;
    }

    const title = String(req.body?.title || `SchoolHub Export ${new Date().toISOString().split('T')[0]}`).trim();
    const sheetName = String(req.body?.sheetName || 'DuLieu').trim();
    const headers = Array.isArray(req.body?.headers) ? (req.body.headers as string[]) : [];
    const rows = Array.isArray(req.body?.rows) ? (req.body.rows as any[][]) : [];
    const extraTabs = Array.isArray(req.body?.extraTabs) ? req.body.extraTabs : [];
    const validationColumns = Array.isArray(req.body?.validationColumns)
      ? (req.body.validationColumns as GoogleSheetValidationColumnSpec[])
      : [];
    const folderId = typeof req.body?.folderId === 'string' ? req.body.folderId.trim() : '';

    const initialGridRows = Math.max(rows.length + 200, 1000);
    const sheetsPayload = [
      {
        properties: {
          title: sheetName,
          gridProperties: {
            frozenRowCount: 1,
            rowCount: initialGridRows,
            columnCount: Math.max(headers.length + 2, 12),
          },
        },
      },
      ...extraTabs.map((t: any) => ({
        properties: {
          title: String(t.sheetName || 'PhuLuc'),
          gridProperties: { frozenRowCount: 1 },
        },
      })),
    ];

    const createRes = await googleApiJson(
      'https://sheets.googleapis.com/v4/spreadsheets',
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          properties: { title, locale: 'vi_VN' },
          sheets: sheetsPayload,
        }),
      },
      { serviceLabel: 'Google Sheets API' }
    );

    if (!createRes.ok) {
      res.status(createRes.status).json({ error: createRes.errorMessage, errorCode: createRes.errorCode });
      return;
    }

    const spreadsheetId = String(createRes.data.spreadsheetId);
    const spreadsheetUrl = String(
      createRes.data.spreadsheetUrl ||
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    );

    // Populate primary & extra tabs via batchUpdate
    const valueData: Array<{ range: string; values: any[][] }> = [];
    if (headers.length > 0 || rows.length > 0) {
      valueData.push({
        range: `'${sheetName.replace(/'/g, "''")}'!A1`,
        values: headers.length > 0 ? [headers, ...rows] : rows,
      });
    }
    for (const t of extraTabs) {
      const tHeaders = Array.isArray(t.headers) ? t.headers : [];
      const tRows = Array.isArray(t.rows) ? t.rows : [];
      if (tHeaders.length > 0 || tRows.length > 0) {
        valueData.push({
          range: `'${String(t.sheetName || 'PhuLuc').replace(/'/g, "''")}'!A1`,
          values: tHeaders.length > 0 ? [tHeaders, ...tRows] : tRows,
        });
      }
    }

    if (valueData.length > 0) {
      const writeValuesRes = await googleApiJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: valueData,
          }),
        },
        { serviceLabel: 'Google Sheets API', sheetName }
      );
      if (!writeValuesRes.ok) {
        res.status(writeValuesRes.status).json({
          error: writeValuesRes.errorMessage,
          errorCode: writeValuesRes.errorCode,
        });
        return;
      }
    }

    // Apply formatting + native ONE_OF_LIST Data Validations
    const createdSheets = Array.isArray(createRes.data?.sheets) ? createRes.data.sheets : [];
    const mainSheetId = Number(createdSheets[0]?.properties?.sheetId || 0);
    let validationMatchedHeaders: string[] = [];

    if (headers.length > 0) {
      const dvBuild = buildSetDataValidationRequests({
        sheetId: mainSheetId,
        headers,
        validationColumns,
        headerRowIndexZeroBased: 0,
        endRowIndex: initialGridRows,
      });
      validationMatchedHeaders = dvBuild.matchedHeaders;

      const formatRes = await googleApiJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId: mainSheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: headers.length,
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.06, green: 0.3, blue: 0.51 },
                      textFormat: {
                        foregroundColor: { red: 1, green: 1, blue: 1 },
                        bold: true,
                        fontSize: 10,
                      },
                      horizontalAlignment: 'CENTER',
                    },
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
                },
              },
              {
                setBasicFilter: {
                  filter: {
                    range: {
                      sheetId: mainSheetId,
                      startRowIndex: 0,
                      endRowIndex: Math.max(rows.length + 1, 2),
                      startColumnIndex: 0,
                      endColumnIndex: headers.length,
                    },
                  },
                },
              },
              {
                autoResizeDimensions: {
                  dimensions: {
                    sheetId: mainSheetId,
                    dimension: 'COLUMNS',
                    startIndex: 0,
                    endIndex: headers.length,
                  },
                },
              },
              ...dvBuild.requests,
            ],
          }),
        },
        { serviceLabel: 'Google Sheets API', sheetName }
      );
      if (!formatRes.ok) {
        res.status(formatRes.status).json({
          error: formatRes.errorMessage,
          errorCode: formatRes.errorCode,
        });
        return;
      }
    }

    // Move to picked folder if requested (keeps private Drive sharing permissions)
    if (folderId) {
      await googleApiJson(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?addParents=${encodeURIComponent(folderId)}&supportsAllDrives=true`,
        token,
        { method: 'PATCH', body: JSON.stringify({}) }
      );
    }

    res.json({
      spreadsheetId,
      spreadsheetUrl,
      title,
      validationsAppliedCount: validationMatchedHeaders.length,
      validationMatchedHeaders,
    });
  });

  // 7B. Google Sheets: Apply / Refresh SchoolHub Data Validation Dropdowns on Existing Sheet (NEVER overwrites cells!)
  app.post('/api/google/sheets/:spreadsheetId/validations', async (req: Request, res: Response) => {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ errorCode: 'TOKEN_EXPIRED', error: 'Vui lòng kết nối Google Workspace trước.' });
      return;
    }

    const { spreadsheetId } = req.params;
    const requestedSheet = String(req.body?.sheetName || '').trim();
    const headerRow = Math.max(1, Number(req.body?.headerRow || 1));
    const validationColumns = Array.isArray(req.body?.validationColumns)
      ? (req.body.validationColumns as GoogleSheetValidationColumnSpec[])
      : [];

    if (validationColumns.length === 0) {
      res.json({
        ok: true,
        spreadsheetId,
        sheetName: requestedSheet,
        appliedCount: 0,
        matchedHeaders: [],
        skippedHeaders: [],
      });
      return;
    }

    const metaRes = await googleApiJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,properties.title,sheets(properties(sheetId,title,gridProperties))`,
      token,
      undefined,
      { serviceLabel: 'Google Sheets API', sheetName: requestedSheet || undefined }
    );

    if (!metaRes.ok) {
      res.status(metaRes.status).json({ error: metaRes.errorMessage, errorCode: metaRes.errorCode });
      return;
    }

    const sheetsList = Array.isArray(metaRes.data?.sheets) ? metaRes.data.sheets : [];
    const targetSheetObj = requestedSheet
      ? sheetsList.find((s: any) => String(s?.properties?.title || '') === requestedSheet) ||
        sheetsList.find((s: any) => String(s?.properties?.title || '').toLowerCase() === requestedSheet.toLowerCase())
      : sheetsList[0];

    if (!targetSheetObj) {
      const availableSheets = sheetsList.map((s: any) => String(s?.properties?.title || '')).filter(Boolean);
      res.status(404).json({
        errorCode: 'SHEET_NOT_FOUND' as GoogleSyncErrorCode,
        error: `Không tìm thấy tab "${requestedSheet}" để áp dụng danh mục dropdown.`,
        availableSheets,
      });
      return;
    }

    const sheetId = Number(targetSheetObj.properties.sheetId || 0);
    const targetTitle = String(targetSheetObj.properties.title || 'Sheet1');
    const gridRowCount = Number(targetSheetObj.properties?.gridProperties?.rowCount || 1000);

    const headerRange = `'${targetTitle.replace(/'/g, "''")}'!A${headerRow}:ZZ${headerRow}`;
    const headerRes = await googleApiJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(headerRange)}?valueRenderOption=FORMATTED_VALUE`,
      token,
      undefined,
      { serviceLabel: 'Google Sheets API', sheetName: targetTitle }
    );

    if (!headerRes.ok) {
      res.status(headerRes.status).json({ error: headerRes.errorMessage, errorCode: headerRes.errorCode });
      return;
    }

    const headers: string[] = Array.isArray(headerRes.data?.values?.[0])
      ? (headerRes.data.values[0] as unknown[]).map((h) => String(h ?? '').trim())
      : [];

    const dvBuild = buildSetDataValidationRequests({
      sheetId,
      headers,
      validationColumns,
      headerRowIndexZeroBased: headerRow - 1,
      endRowIndex: Math.max(gridRowCount, headerRow + 500, 1000),
    });

    if (dvBuild.requests.length > 0) {
      const batchRes = await googleApiJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({ requests: dvBuild.requests }),
        },
        { serviceLabel: 'Google Sheets API', sheetName: targetTitle }
      );
      if (!batchRes.ok) {
        res.status(batchRes.status).json({ error: batchRes.errorMessage, errorCode: batchRes.errorCode });
        return;
      }
    }

    res.json({
      ok: true,
      spreadsheetId,
      sheetName: targetTitle,
      appliedCount: dvBuild.matchedHeaders.length,
      matchedHeaders: dvBuild.matchedHeaders,
      skippedHeaders: dvBuild.skippedHeaders,
    });
  });

  // 8. Google Docs: Read & Parse Structure
  app.get('/api/google/docs/:documentId/read', async (req: Request, res: Response) => {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ errorCode: 'TOKEN_EXPIRED', error: 'Vui lòng kết nối Google Workspace trước.' });
      return;
    }
    const { documentId } = req.params;

    const [docRes, driveMetaRes] = await Promise.all([
      googleApiJson(
        `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
        token,
        undefined,
        { serviceLabel: 'Google Docs API' }
      ),
      googleApiJson(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(documentId)}?fields=modifiedTime,webViewLink&supportsAllDrives=true`,
        token,
        undefined,
        { serviceLabel: 'Google Drive API' }
      ),
    ]);

    if (!docRes.ok) {
      res.status(docRes.status).json({ error: docRes.errorMessage, errorCode: docRes.errorCode });
      return;
    }

    const parsed = extractStructuredGoogleDoc(docRes.data);
    res.json({
      ...parsed,
      modifiedTime: driveMetaRes.ok ? driveMetaRes.data?.modifiedTime : undefined,
      webViewLink:
        (driveMetaRes.ok && driveMetaRes.data?.webViewLink) ||
        `https://docs.google.com/document/d/${documentId}/edit`,
    });
  });

  // 9. Google Docs: Create New Formatted Document
  app.post('/api/google/docs/create', async (req: Request, res: Response) => {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ errorCode: 'TOKEN_EXPIRED', error: 'Vui lòng kết nối Google Workspace trước.' });
      return;
    }
    const title = String(req.body?.title || `Bao cao SchoolHub ${new Date().toISOString().split('T')[0]}`).trim();
    const sections = Array.isArray(req.body?.sections) ? (req.body.sections as DocSectionInput[]) : [];
    const folderId = typeof req.body?.folderId === 'string' ? req.body.folderId.trim() : '';

    const createRes = await googleApiJson(
      'https://docs.googleapis.com/v1/documents',
      token,
      {
        method: 'POST',
        body: JSON.stringify({ title }),
      },
      { serviceLabel: 'Google Docs API' }
    );

    if (!createRes.ok) {
      res.status(createRes.status).json({ error: createRes.errorMessage, errorCode: createRes.errorCode });
      return;
    }

    const documentId = String(createRes.data.documentId);
    const writeRes = await writeSectionsToGoogleDoc(documentId, token, sections, false);
    if (!writeRes.ok) {
      res.status(writeRes.status).json({ error: writeRes.errorMessage });
      return;
    }

    if (folderId) {
      await googleApiJson(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(documentId)}?addParents=${encodeURIComponent(folderId)}&supportsAllDrives=true`,
        token,
        { method: 'PATCH', body: JSON.stringify({}) },
        { serviceLabel: 'Google Drive API' }
      );
    }

    res.json({
      documentId,
      documentUrl: `https://docs.google.com/document/d/${documentId}/edit`,
      title,
    });
  });

  // 10. Google Docs: Update Existing Document (Replace or Append)
  app.post('/api/google/docs/:documentId/update', async (req: Request, res: Response) => {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ errorCode: 'TOKEN_EXPIRED', error: 'Vui lòng kết nối Google Workspace trước.' });
      return;
    }
    const { documentId } = req.params;
    const mode = req.body?.mode === 'append' ? 'append' : 'replace';
    const sections = Array.isArray(req.body?.sections) ? (req.body.sections as DocSectionInput[]) : [];

    const writeRes = await writeSectionsToGoogleDoc(
      documentId,
      token,
      sections,
      mode === 'replace'
    );
    if (!writeRes.ok) {
      res.status(writeRes.status).json({ error: writeRes.errorMessage });
      return;
    }

    res.json({
      documentId,
      documentUrl: `https://docs.google.com/document/d/${documentId}/edit`,
    });
  });

  // 11. Google Drive Changes Watch & Webhook Receiver
  app.post('/api/google/drive/watch', async (req: Request, res: Response) => {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ errorCode: 'TOKEN_EXPIRED', error: 'Vui lòng kết nối Google Workspace trước.' });
      return;
    }

    const readiness = getWebhookReadiness();
    const tokenRes = await googleApiJson(
      'https://www.googleapis.com/drive/v3/changes/startPageToken?supportsAllDrives=true',
      token,
      undefined,
      { serviceLabel: 'Google Drive API' }
    );
    if (!tokenRes.ok) {
      res.status(tokenRes.status).json({ error: tokenRes.errorMessage, errorCode: tokenRes.errorCode });
      return;
    }

    const startPageToken = String(tokenRes.data?.startPageToken || '');

    if (!readiness.webhookCapable || !readiness.webhookUrl) {
      res.json({
        active: false,
        startPageToken,
        reason: 'LOCAL_OR_NO_HTTPS',
        message: readiness.webhookMessage,
      });
      return;
    }

    const channelId = `schoolhub-${String(req.body?.sourceId || 'ch')}-${crypto.randomBytes(4).toString('hex')}`;
    const expirationMs = Date.now() + 24 * 60 * 60 * 1000;

    const watchRes = await googleApiJson(
      `https://www.googleapis.com/drive/v3/changes/watch?pageToken=${encodeURIComponent(startPageToken)}&supportsAllDrives=true`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: readiness.webhookUrl,
          expiration: String(expirationMs),
        }),
      }
    );

    if (!watchRes.ok) {
      res.json({
        active: false,
        startPageToken,
        reason: 'WATCH_REGISTER_FAILED',
        message: watchRes.errorMessage || 'Không thể đăng ký Push Webhook, đã chuyển sang đồng bộ theo dõi Changes API.',
      });
      return;
    }

    res.json({
      active: true,
      channelId,
      resourceId: watchRes.data?.resourceId,
      expiration: new Date(Number(watchRes.data?.expiration || expirationMs)).toISOString(),
      startPageToken,
    });
  });

  app.post('/api/google/drive/stop-watch', async (req: Request, res: Response) => {
    const token = extractToken(req);
    const channelId = String(req.body?.channelId || '');
    const resourceId = String(req.body?.resourceId || '');
    if (token && channelId && resourceId) {
      await googleApiJson('https://www.googleapis.com/drive/v3/channels/stop', token, {
        method: 'POST',
        body: JSON.stringify({ id: channelId, resourceId }),
      }).catch(() => undefined);
    }
    res.json({ ok: true });
  });

  app.get('/api/google/drive/changes', async (req: Request, res: Response) => {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ errorCode: 'TOKEN_EXPIRED', error: 'Vui lòng kết nối Google Workspace trước.' });
      return;
    }

    const fetchFreshStartToken = async () => {
      const startRes = await googleApiJson(
        'https://www.googleapis.com/drive/v3/changes/startPageToken?supportsAllDrives=true',
        token,
        undefined,
        { serviceLabel: 'Google Drive API' }
      );
      return startRes;
    };

    let pageToken = String(req.query.pageToken || '');
    if (!pageToken) {
      const startRes = await fetchFreshStartToken();
      if (!startRes.ok) {
        res.status(startRes.status).json({ error: startRes.errorMessage, errorCode: startRes.errorCode });
        return;
      }
      pageToken = String(startRes.data?.startPageToken || '');
      res.json({
        newStartPageToken: pageToken,
        changes: [],
      });
      return;
    }

    let listRes = await googleApiJson(
      `https://www.googleapis.com/drive/v3/changes?pageToken=${encodeURIComponent(pageToken)}&fields=newStartPageToken,nextPageToken,changes(fileId,removed,time,file(id,name,modifiedTime,trashed))&supportsAllDrives=true`,
      token,
      undefined,
      { serviceLabel: 'Google Drive API' }
    );
    if (!listRes.ok && (listRes.status === 400 || listRes.status === 410)) {
      const fresh = await fetchFreshStartToken();
      if (fresh.ok && fresh.data?.startPageToken) {
        res.json({
          newStartPageToken: String(fresh.data.startPageToken),
          changes: [],
        });
        return;
      }
    }
    if (!listRes.ok) {
      res.status(listRes.status).json({ error: listRes.errorMessage, errorCode: listRes.errorCode });
      return;
    }

    res.json({
      newStartPageToken: listRes.data?.newStartPageToken || listRes.data?.nextPageToken || pageToken,
      changes: Array.isArray(listRes.data?.changes) ? listRes.data.changes : [],
    });
  });

  app.post('/api/google/drive-webhook', (req: Request, res: Response) => {
    const channelId = String(req.header('X-Goog-Channel-ID') || '');
    const resourceId = String(req.header('X-Goog-Resource-ID') || '');
    const resourceState = String(req.header('X-Goog-Resource-State') || '');
    const messageNumber = String(req.header('X-Goog-Message-Number') || '');

    if (!channelId || !resourceState) {
      res.status(200).json({ ignored: true });
      return;
    }

    const dedupeKey = `${channelId}:${messageNumber}:${resourceState}`;
    if (seenWebhookMessageKeys.has(dedupeKey)) {
      res.status(200).json({ deduplicated: true });
      return;
    }
    seenWebhookMessageKeys.add(dedupeKey);
    if (seenWebhookMessageKeys.size > 1000) {
      const firstKey = seenWebhookMessageKeys.values().next().value;
      if (firstKey) seenWebhookMessageKeys.delete(firstKey);
    }

    if (resourceState !== 'sync') {
      webhookEventQueue.unshift({
        id: `WH-${Date.now()}-${messageNumber}`,
        channelId,
        resourceId,
        resourceState,
        messageNumber,
        receivedAt: new Date().toISOString(),
      });
      if (webhookEventQueue.length > 100) webhookEventQueue.length = 100;
    }

    res.status(200).json({ received: true });
  });

  app.get('/api/google/events', (_req: Request, res: Response) => {
    res.json({ events: webhookEventQueue.slice(0, 30) });
  });

  // 12. AI Column Mapping Suggestion
  app.post('/api/ai/map-columns', async (req: Request, res: Response) => {
    const headers = Array.isArray(req.body?.headers) ? (req.body.headers as string[]) : [];
    const targetFields = Array.isArray(req.body?.targetFields) ? req.body.targetFields : [];
    const sampleRows = Array.isArray(req.body?.sampleRows) ? req.body.sampleRows.slice(0, 3) : [];

    const fallback: Record<string, string> = {};
    for (const h of headers) {
      const nh = normalizeHeaderToken(h);
      const found = targetFields.find(
        (tf: any) =>
          normalizeHeaderToken(tf.key) === nh ||
          normalizeHeaderToken(tf.label) === nh ||
          normalizeHeaderToken(tf.header) === nh
      );
      if (found) fallback[h] = found.key;
    }

    try {
      const ai = getGeminiClient();
      if (!ai || headers.length === 0 || targetFields.length === 0) {
        res.json({ suggestions: fallback, source: 'deterministic' });
        return;
      }

      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: [
          'Hãy ánh xạ tiêu đề cột từ Google Sheets sang targetFields của SchoolHub.',
          `Headers: ${JSON.stringify(headers)}`,
          `SampleRows: ${JSON.stringify(sampleRows)}`,
          `TargetFields: ${JSON.stringify(targetFields)}`,
          'Chỉ chọn các key có trong targetFields; nếu cột không khớp trường nào hãy bỏ qua.',
        ].join('\n'),
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mappings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sheetColumn: { type: Type.STRING },
                    targetFieldKey: { type: Type.STRING },
                  },
                  required: ['sheetColumn', 'targetFieldKey'],
                },
              },
            },
            required: ['mappings'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const aiMap: Record<string, string> = { ...fallback };
      for (const item of parsed.mappings || []) {
        if (targetFields.some((tf: any) => tf.key === item.targetFieldKey)) {
          aiMap[item.sheetColumn] = item.targetFieldKey;
        }
      }
      res.json({ suggestions: aiMap, source: 'gemini' });
    } catch {
      res.json({ suggestions: fallback, source: 'fallback' });
    }
  });

  // 13. AI Google Doc Change Analysis -> Draft Proposals (NEVER auto-approves!)
  app.post('/api/ai/analyze-doc-changes', async (req: Request, res: Response) => {
    const fileName = String(req.body?.fileName || 'Google Doc');
    const previousText = String(req.body?.previousText || '');
    const nextText = String(req.body?.nextText || '');
    const targetModule = String(req.body?.targetModule || 'rules_doc');

    const diffs = diffDocTexts(previousText, nextText);
    const addedCount = diffs.filter((d) => d.type === 'added').length;
    const removedCount = diffs.filter((d) => d.type === 'removed').length;
    const localCriteria =
      targetModule === 'rules_doc' ? parseRuleClausesLocally(nextText) : [];

    const fallbackSummary =
      previousText.trim() === ''
        ? `Tài liệu "${fileName}" vừa được liên kết lần đầu (${nextText.split(/\s+/).filter(Boolean).length} từ). Phát hiện ${localCriteria.length} điều khoản nháp chờ Admin/BGH phê duyệt.`
        : `Tài liệu "${fileName}" có +${addedCount} dòng/điều khoản bổ sung và -${removedCount} dòng bị gỡ bỏ. Tất cả đề xuất đang ở trạng thái Bản nháp (Draft) chờ duyệt.`;

    try {
      const ai = getGeminiClient();
      if (!ai) {
        res.json({
          summary: fallbackSummary,
          proposedCriteria: localCriteria,
          source: 'local-assistant',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: [
          `Phân tích thay đổi nội dung Google Docs "${fileName}" (phân hệ: ${targetModule}).`,
          'YÊU CẦU: Tóm tắt ngắn gọn thay đổi bằng tiếng Việt và chỉ trích xuất điều khoản thực tế có trong văn bản (nếu văn bản không nêu điểm số thì đặt pointsSpecified=false, points=null). Không tự ý áp dụng hay bịa điểm.',
          `Văn bản trước:\n${previousText.slice(0, 6000)}`,
          `Văn bản mới:\n${nextText.slice(0, 6000)}`,
        ].join('\n\n'),
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              criteria: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    code: { type: Type.STRING },
                    categoryName: { type: Type.STRING },
                    name: { type: Type.STRING },
                    behavior: { type: Type.STRING },
                    type: { type: Type.STRING },
                    pointsSpecified: { type: Type.BOOLEAN },
                    points: { type: Type.NUMBER, nullable: true },
                    targetScope: { type: Type.STRING },
                    sourceClause: { type: Type.STRING },
                  },
                  required: ['code', 'categoryName', 'name', 'behavior', 'type', 'pointsSpecified', 'targetScope'],
                },
              },
            },
            required: ['summary', 'criteria'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const criteria = Array.isArray(parsed.criteria)
        ? parsed.criteria.map((c: any, idx: number) => ({
            ...c,
            tempId: c.tempId || `AI-GDOC-${Date.now()}-${idx}`,
            group: c.group || c.categoryName || 'Quy định chung',
            categoryName: c.categoryName || c.group || 'Quy định chung',
            description: c.description || c.behavior || c.name || '',
            type: c.type === 'achievement' ? 'achievement' : 'violation',
            target:
              c.target === 'class' || c.target === 'group' || c.target === 'individual'
                ? c.target
                : c.targetScope === 'class' || c.targetScope === 'group'
                ? c.targetScope
                : 'individual',
            points: c.pointsSpecified && typeof c.points === 'number' ? c.points : null,
            pointsSpecified: Boolean(c.pointsSpecified && typeof c.points === 'number'),
            selected: true,
          }))
        : localCriteria;

      res.json({
        summary: parsed.summary || fallbackSummary,
        proposedCriteria: criteria,
        source: 'gemini',
      });
    } catch {
      res.json({
        summary: fallbackSummary,
        proposedCriteria: localCriteria,
        source: 'fallback',
      });
    }
  });
}
