import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnalyticsAnalyzePrompt,
  buildAnalyticsAnalyzeSystemInstruction,
  buildCopilotChatSystemInstruction,
  normalizeCopilotChatTurns,
} from './aiPrompts';
import { parseSseBlock } from './aiStreamClient';

test('normalizeCopilotChatTurns merges consecutive turns and ensures user-first order', () => {
  const turns = normalizeCopilotChatTurns({
    message: 'Quy trình mượn sách RFID?',
    messages: [
      { role: 'assistant', content: 'Chào bạn' },
      { role: 'user', content: 'Hỏi về thư viện' },
      { role: 'user', content: 'Chi tiết hơn' },
      { role: 'assistant', content: 'Bước 1...' },
    ],
  });

  assert.equal(turns.length, 3);
  assert.equal(turns[0].role, 'user');
  assert.match(turns[0].parts[0].text, /Hỏi về thư viện/);
  assert.match(turns[0].parts[0].text, /Chi tiết hơn/);
  assert.equal(turns[1].role, 'model');
  assert.equal(turns[2].role, 'user');
  assert.equal(turns[2].parts[0].text, 'Quy trình mượn sách RFID?');
});

test('buildCopilotChatSystemInstruction enforces concise, no-greeting, step-by-step output', () => {
  const prompt = buildCopilotChatSystemInstruction({
    displayName: 'Nguyễn Văn A',
    effectiveRole: 'admin',
    contextSummary: 'HS: 500, Sách: 120',
  });

  assert.match(prompt, /KHÔNG chào hỏi/);
  assert.match(prompt, /ĐỦ TỪNG BƯỚC/);
  assert.match(prompt, /100–220 từ/);
  assert.match(prompt, /HS: 500, Sách: 120/);
});

test('buildAnalyticsAnalyzeSystemInstruction and Prompt enforce structured step-by-step report', () => {
  const sys = buildAnalyticsAnalyzeSystemInstruction();
  assert.match(sys, /Số liệu thực tế/);
  assert.match(sys, /Đề xuất hành động từng bước/);
  assert.match(sys, /KHÔNG chào hỏi/);

  const userPrompt = buildAnalyticsAnalyzePrompt({
    focus: 'Thư viện RFID',
    role: 'librarian',
    question: 'Tối ưu lượt mượn',
    stats: { booksCount: 20, activeLoans: 3 },
  });
  assert.match(userPrompt, /Thư viện RFID/);
  assert.match(userPrompt, /Tối ưu lượt mượn/);
  assert.match(userPrompt, /"booksCount":20/);
});

test('parseSseBlock parses delta, replace, done, and error events safely', () => {
  assert.deepEqual(parseSseBlock('data: {"delta":"Bước 1"}'), { delta: 'Bước 1' });
  assert.deepEqual(parseSseBlock('data: {"done":true,"text":"Hoàn tất"}'), {
    done: true,
    text: 'Hoàn tất',
  });
  assert.equal(parseSseBlock('data: [DONE]'), null);
  assert.equal(parseSseBlock('data: {invalid'), null);
});
