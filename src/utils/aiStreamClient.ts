export interface SseStreamEvent {
  delta?: string;
  replace?: string;
  done?: boolean;
  text?: string;
  error?: string;
}

export function parseSseBlock(block: string): SseStreamEvent | null {
  const dataLines = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());
  if (!dataLines.length) return null;
  const rawJson = dataLines.join('\n').trim();
  if (!rawJson || rawJson === '[DONE]') return null;
  try {
    return JSON.parse(rawJson) as SseStreamEvent;
  } catch {
    return null;
  }
}

export async function postSseWithFallback(params: {
  streamUrl: string;
  fallbackUrl: string;
  payload: Record<string, unknown>;
  signal: AbortSignal;
  isTimedOut: () => boolean;
  onUpdate: (text: string) => void;
}): Promise<string> {
  const { streamUrl, fallbackUrl, payload, signal, isTimedOut, onUpdate } = params;

  const runFallback = async (): Promise<string> => {
    const res = await fetch(fallbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    const data = await res.json().catch(() => ({}));
    const fallbackText = String(data?.text || '').trim();
    if (!res.ok || !fallbackText) {
      throw new Error(String(data?.error || 'Không thể kết nối Trợ lý AI lúc này.'));
    }
    onUpdate(fallbackText);
    return fallbackText;
  };

  const response = await fetch(streamUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const shouldFallback =
      !data?.exhaustedFallback && ![400, 401, 403, 429].includes(response.status);
    if (shouldFallback) {
      return runFallback();
    }
    throw new Error(String(data?.error || 'Không thể kết nối Trợ lý AI lúc này.'));
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('text/event-stream') || !response.body) {
    const data = await response.json().catch(() => ({}));
    const text = String(data?.text || '').trim();
    if (!text) {
      return runFallback();
    }
    onUpdate(text);
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  const consumeBlocks = (blocks: string[]) => {
    for (const block of blocks) {
      const ev = parseSseBlock(block);
      if (!ev) continue;
      if (ev.error) {
        throw new Error(ev.error);
      }
      if (typeof ev.replace === 'string' && ev.replace) {
        fullText = ev.replace;
        onUpdate(fullText);
      }
      if (typeof ev.delta === 'string' && ev.delta) {
        fullText += ev.delta;
        onUpdate(fullText);
      }
      if (ev.done && typeof ev.text === 'string' && ev.text.length >= fullText.length) {
        fullText = ev.text;
        onUpdate(fullText);
      }
    }
  };

  try {
    while (true) {
      const step = await reader.read();
      if (step.done) break;
      buffer += decoder.decode(step.value, { stream: true }).replace(/\r\n/g, '\n');
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      consumeBlocks(parts);
    }
    if (buffer.trim()) {
      consumeBlocks([buffer]);
    }
  } catch (streamErr) {
    if (!fullText.trim() && !isTimedOut()) {
      return runFallback();
    }
    throw streamErr;
  }

  const trimmed = fullText.trim();
  if (!trimmed) {
    return runFallback();
  }
  return trimmed;
}
