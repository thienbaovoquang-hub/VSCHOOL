import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  callGroqChatCompletions,
  convertContentsToGroqMessages,
  DEFAULT_GROQ_TEXT_MODELS,
  DEFAULT_GROQ_VISION_MODELS,
  formatGroqErrorMessage,
  getCandidateGroqApiKeys,
  getGroqCandidateModels,
  GroqApiError,
  normalizeGroqApiKey,
  parseGroqSseLine,
  streamGroqChatCompletions,
} from './groqClient.ts';

test('normalizeGroqApiKey and getCandidateGroqApiKeys strip quotes and reject placeholders or invalid prefixes', () => {
  assert.equal(normalizeGroqApiKey('"MY_GROQ_API_KEY"'), '');
  assert.equal(normalizeGroqApiKey('AIzaSyNotAGroqKey'), '');
  assert.equal(normalizeGroqApiKey('   '), '');
  assert.equal(normalizeGroqApiKey(' "gsk_abc123valid" '), 'gsk_abc123valid');

  const keys = getCandidateGroqApiKeys({
    GROQ_API_KEY: 'MY_GROQ_API_KEY',
    CUSTOM_GROQ_API_KEY: 'gsk_backup_789',
  });
  assert.deepEqual(keys, ['gsk_backup_789']);
});

test('getGroqCandidateModels picks text vs vision models and honors custom env overrides', () => {
  assert.deepEqual(getGroqCandidateModels(false, {}), [...DEFAULT_GROQ_TEXT_MODELS]);
  assert.deepEqual(getGroqCandidateModels(true, {}), [...DEFAULT_GROQ_VISION_MODELS]);
  assert.equal(
    getGroqCandidateModels(false, { GROQ_MODEL: 'openai/gpt-oss-120b' })[0],
    'openai/gpt-oss-120b'
  );
  assert.equal(
    getGroqCandidateModels(true, { GROQ_VISION_MODEL: 'meta-llama/llama-4-maverick-17b-128e-instruct' })[0],
    'meta-llama/llama-4-maverick-17b-128e-instruct'
  );
});

test('convertContentsToGroqMessages converts strings, alternating turns, system instruction, images, and detects PDFs', () => {
  const simple = convertContentsToGroqMessages('Xin chào', 'Bạn là gia sư Toán');
  assert.equal(simple.hasImages, false);
  assert.equal(simple.hasPdfParts, false);
  assert.deepEqual(simple.messages, [
    { role: 'system', content: 'Bạn là gia sư Toán' },
    { role: 'user', content: 'Xin chào' },
  ]);

  const rich = convertContentsToGroqMessages([
    { role: 'model', parts: [{ text: 'Chào em' }] },
    {
      role: 'user',
      parts: [
        { text: 'Giải bài này' },
        { inlineData: { mimeType: 'image/jpg', data: 'imgdata==' } },
      ],
    },
    { role: 'model', parts: [{ text: 'Bước 1...' }] },
  ]);

  assert.equal(rich.hasImages, true);
  assert.equal(rich.hasPdfParts, false);
  assert.equal(rich.messages.length, 2);
  assert.equal(rich.messages[0].role, 'user');
  assert.deepEqual(rich.messages[0].content, [
    { type: 'text', text: 'Giải bài này' },
    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,imgdata==' } },
  ]);
  assert.deepEqual(rich.messages[1], { role: 'assistant', content: 'Bước 1...' });
});

test('parseGroqSseLine extracts delta content and upstream errors', () => {
  assert.deepEqual(
    parseGroqSseLine('data: {"choices":[{"delta":{"content":"Xin chào "}}]}'),
    { delta: 'Xin chào ' }
  );
  assert.equal(parseGroqSseLine('data: [DONE]'), null);
  assert.deepEqual(
    parseGroqSseLine('data: {"error":{"message":"Rate limit reached"}}'),
    { error: 'Rate limit reached' }
  );
});

test('callGroqChatCompletions falls back across models on 429/503 and returns parsed JSON in jsonMode', async () => {
  const seenModels: string[] = [];
  const mockFetch: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body || '{}')) as {
      model: string;
      response_format?: { type?: string };
    };
    seenModels.push(body.model);
    if (body.model === DEFAULT_GROQ_TEXT_MODELS[0]) {
      return new Response(JSON.stringify({ error: { message: 'rate limit' } }), { status: 429 });
    }
    assert.equal(body.response_format?.type, 'json_object');
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: '```json\n{"ok":true,"count":3}\n```' } }],
      }),
      { status: 200 }
    );
  };

  const res = await callGroqChatCompletions({
    apiKeys: ['gsk_test_1'],
    contents: 'Tạo JSON',
    jsonMode: true,
    fetchImpl: mockFetch,
  });

  assert.deepEqual(seenModels, [DEFAULT_GROQ_TEXT_MODELS[0], DEFAULT_GROQ_TEXT_MODELS[1]]);
  assert.equal(res.model, DEFAULT_GROQ_TEXT_MODELS[1]);
  assert.deepEqual(JSON.parse(res.text), { ok: true, count: 3 });
});

test('streamGroqChatCompletions streams deltas cleanly in order', async () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode('data: {"choices":[{"delta":{"content":"Định lý "}}]}\n\n')
      );
      controller.enqueue(
        encoder.encode('data: {"choices":[{"delta":{"content":"Pythagore"}}]}\n\ndata: [DONE]\n\n')
      );
      controller.close();
    },
  });

  const chunks: string[] = [];
  const result = await streamGroqChatCompletions({
    apiKeys: ['gsk_stream_test'],
    models: ['llama-3.3-70b-versatile'],
    contents: 'Phát biểu định lý Pythagore',
    onDelta: (d) => chunks.push(d),
    fetchImpl: async () => new Response(stream, { status: 200 }),
  });

  assert.deepEqual(chunks, ['Định lý ', 'Pythagore']);
  assert.equal(result.text, 'Định lý Pythagore');
});

test('formatGroqErrorMessage formats invalid key and rate limit errors clearly in Vietnamese', () => {
  const badKey = formatGroqErrorMessage(new GroqApiError(401, 'Invalid API Key'));
  assert.ok(badKey.includes('GROQ_API_KEY'));
  assert.ok(badKey.includes('Settings > Secrets'));

  const rateLimit = formatGroqErrorMessage(new GroqApiError(429, 'Rate limit exceeded'));
  assert.ok(rateLimit.includes('429'));
});

test('server.ts prioritizes Groq API, disables unusable fallback keys, and extracts PDFs locally with unpdf', () => {
  const serverSrc = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
  assert.ok(serverSrc.includes('callGroqChatCompletions'));
  assert.ok(serverSrc.includes('streamGroqChatCompletions'));
  assert.ok(serverSrc.includes('isUnusableGeminiFallbackError'));
  assert.ok(serverSrc.includes('extractPdfTextLocally'));
  assert.ok(serverSrc.includes("from 'unpdf'"));
  assert.ok(serverSrc.includes('GROQ_API_KEY'));
});
