(function (global) {
  'use strict';

  var listeners = [];

  function hasParentWindow() {
    try {
      return Boolean(global.parent && global.parent !== global);
    } catch (_err) {
      return false;
    }
  }

  function escapeHtml(raw) {
    return String(raw || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatInlineMarkdown(escapedLine) {
    var out = escapedLine.replace(
      /`([^`\n]+)`/g,
      '<code style="padding:1px 5px;border-radius:5px;background:rgba(128,128,128,0.14);font-family:monospace;font-size:0.92em">$1</code>'
    );
    out = out.replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[\s(>])\*([^*\n]+?)\*(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>');
    return out;
  }

  function renderMarkdown(raw) {
    var safe = escapeHtml(raw);
    var lines = safe.split(/\r?\n/);
    return lines
      .map(function (line) {
        if (/^#{1,3}\s+/.test(line)) {
          return '<div style="font-weight:700;margin:6px 0 2px">' + formatInlineMarkdown(line.replace(/^#{1,3}\s+/, '')) + '</div>';
        }
        if (/^[-*•]\s+/.test(line)) {
          return '<div style="padding-left:10px">• ' + formatInlineMarkdown(line.replace(/^[-*•]\s+/, '')) + '</div>';
        }
        return formatInlineMarkdown(line);
      })
      .join('<br>');
  }

  function emitContext(payload) {
    if (!hasParentWindow() || !payload || !payload.subjectId) return false;
    global.parent.postMessage(
      {
        source: 'schoolhub-subject',
        type: 'subject:context',
        payload: {
          subjectId: String(payload.subjectId),
          view: String(payload.view || ''),
          topic: String(payload.topic || ''),
          summary: String(payload.summary || ''),
          wrongCount: Number(payload.wrongCount || 0) || 0,
        },
      },
      '*'
    );
    return true;
  }

  function openParentAi(payload) {
    if (!hasParentWindow() || !payload || !payload.subjectId) return false;
    global.parent.postMessage(
      {
        source: 'schoolhub-subject',
        type: 'subject:open-ai',
        payload: {
          subjectId: String(payload.subjectId),
          mode: String(payload.mode || 'tutor_chat'),
          prompt: String(payload.prompt || ''),
          contextText: String(payload.contextText || ''),
          autoSend: Boolean(payload.autoSend),
        },
      },
      '*'
    );
    return true;
  }

  function parseSseBuffer(buffer) {
    var normalized = buffer.replace(/\r\n/g, '\n');
    var blocks = normalized.split('\n\n');
    var remainder = blocks.pop();
    if (typeof remainder !== 'string') remainder = '';
    var events = [];
    for (var i = 0; i < blocks.length; i++) {
      var dataLines = blocks[i]
        .split('\n')
        .filter(function (l) {
          return l.indexOf('data:') === 0;
        })
        .map(function (l) {
          return l.slice(5).replace(/^\s+/, '');
        });
      if (!dataLines.length) continue;
      var rawJson = dataLines.join('\n').trim();
      if (!rawJson || rawJson === '[DONE]') continue;
      try {
        events.push(JSON.parse(rawJson));
      } catch (_e) {
        // ignore partial JSON frame
      }
    }
    return { events: events, remainder: remainder };
  }

  function createRequestSignal(externalSignal, timeoutMs) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timedOut = false;
    var onExternalAbort = null;
    var timer = controller
      ? global.setTimeout(function () {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : null;

    if (controller && externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else if (typeof externalSignal.addEventListener === 'function') {
        onExternalAbort = function () {
          controller.abort();
        };
        externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    return {
      signal: controller ? controller.signal : externalSignal,
      didTimeout: function () {
        return timedOut;
      },
      cleanup: function () {
        if (timer !== null) global.clearTimeout(timer);
        if (externalSignal && onExternalAbort && typeof externalSignal.removeEventListener === 'function') {
          externalSignal.removeEventListener('abort', onExternalAbort);
        }
      },
    };
  }

  async function streamAssist(opts) {
    if (!opts || !opts.subjectId) {
      throw new Error('Thiếu mã môn học (subjectId).');
    }
    var body = {
      subjectId: opts.subjectId,
      mode: opts.mode || 'tutor_chat',
      prompt: opts.prompt || '',
      messages: Array.isArray(opts.messages) ? opts.messages : undefined,
      contextText: opts.contextText || '',
      previousSolution: opts.previousSolution || '',
      image: opts.image || null,
    };

    var reqCtrl = createRequestSignal(opts.signal, 25000);
    try {
      var response = await global.fetch('/api/ai/subject-assist-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: reqCtrl.signal,
      });

      var contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (!response.ok) {
        var errData = {};
        try {
          errData = await response.json();
        } catch (_e) {
          errData = {};
        }
        var errMsg = errData.error || 'Không thể kết nối Trợ lý AI Gemini (HTTP ' + response.status + ').';
        if (typeof opts.onError === 'function') opts.onError(errMsg);
        throw new Error(errMsg);
      }

      if (contentType.indexOf('text/event-stream') !== -1 && response.body && response.body.getReader) {
        var reader = response.body.getReader();
        var decoder = new TextDecoder('utf-8');
        var buffer = '';
        var fullText = '';

        while (true) {
          var step = await reader.read();
          if (step.done) break;
          buffer += decoder.decode(step.value, { stream: true });
          var parsed = parseSseBuffer(buffer);
          buffer = parsed.remainder;
          for (var i = 0; i < parsed.events.length; i++) {
            var ev = parsed.events[i];
            if (ev.error) {
              if (typeof opts.onError === 'function') opts.onError(ev.error);
              throw new Error(ev.error);
            }
            if (typeof ev.delta === 'string' && ev.delta) {
              fullText += ev.delta;
              if (typeof opts.onDelta === 'function') opts.onDelta(ev.delta, fullText);
            }
            if (ev.done && typeof ev.text === 'string' && ev.text.length > fullText.length) {
              fullText = ev.text;
            }
          }
        }

        if (buffer.trim()) {
          var tail = parseSseBuffer(buffer + '\n\n');
          for (var j = 0; j < tail.events.length; j++) {
            var tailEv = tail.events[j];
            if (tailEv.error) {
              if (typeof opts.onError === 'function') opts.onError(tailEv.error);
              throw new Error(tailEv.error);
            }
            if (typeof tailEv.delta === 'string' && tailEv.delta) {
              fullText += tailEv.delta;
              if (typeof opts.onDelta === 'function') opts.onDelta(tailEv.delta, fullText);
            }
            if (tailEv.done && typeof tailEv.text === 'string' && tailEv.text.length > fullText.length) {
              fullText = tailEv.text;
            }
          }
        }

        var finalText = fullText.trim();
        if (!finalText) {
          var emptyErr = 'Trợ lý AI chưa trả về nội dung phù hợp.';
          if (typeof opts.onError === 'function') opts.onError(emptyErr);
          throw new Error(emptyErr);
        }
        if (typeof opts.onDone === 'function') opts.onDone(finalText);
        return finalText;
      }

      var jsonData = await response.json();
      var text = String(jsonData.text || '').trim();
      if (!text) {
        throw new Error(jsonData.error || 'Trợ lý AI chưa trả về nội dung phù hợp.');
      }
      if (typeof opts.onDelta === 'function') opts.onDelta(text, text);
      if (typeof opts.onDone === 'function') opts.onDone(text);
      return text;
    } catch (err) {
      if (reqCtrl.didTimeout()) {
        var timeoutMsg = 'Yêu cầu Trợ lý AI vượt quá thời gian chờ phản hồi. Vui lòng thử lại sau vài giây.';
        if (typeof opts.onError === 'function') opts.onError(timeoutMsg);
        throw new Error(timeoutMsg);
      }
      throw err;
    } finally {
      reqCtrl.cleanup();
    }
  }

  async function callStructured(payload) {
    var reqCtrl = createRequestSignal(null, 25000);
    try {
      var response = await global.fetch('/api/ai/subject-structured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: reqCtrl.signal,
      });
      var data = await response.json().catch(function () {
        return {};
      });
      if (!response.ok) {
        throw new Error(data.error || 'Không thể xử lý yêu cầu AI có cấu trúc (HTTP ' + response.status + ').');
      }
      return data;
    } catch (err) {
      if (reqCtrl.didTimeout()) {
        throw new Error('Yêu cầu AI tạo nội dung vượt quá thời gian chờ. Vui lòng thử lại sau vài giây.');
      }
      throw err;
    } finally {
      reqCtrl.cleanup();
    }
  }

  function generateQuiz(opts) {
    return callStructured({
      action: 'generate_quiz',
      subjectId: opts.subjectId,
      topic: opts.topic || '',
      count: opts.count || 4,
      contextText: opts.contextText || '',
    });
  }

  function generateCards(opts) {
    return callStructured({
      action: 'generate_study_cards',
      subjectId: opts.subjectId,
      topic: opts.topic || '',
      count: opts.count || 4,
      contextText: opts.contextText || '',
    });
  }

  function evaluateWriting(opts) {
    return callStructured({
      action: 'evaluate_writing',
      subjectId: opts.subjectId,
      promptTitle: opts.promptTitle || '',
      studentText: opts.studentText || '',
      referenceText: opts.referenceText || '',
    });
  }

  function onHostCommand(cb) {
    if (typeof cb !== 'function') return function () {};
    listeners.push(cb);
    return function () {
      listeners = listeners.filter(function (fn) {
        return fn !== cb;
      });
    };
  }

  global.addEventListener('message', function (event) {
    var msg = event && event.data;
    if (!msg || typeof msg !== 'object' || msg.source !== 'schoolhub-host') return;
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](msg);
      } catch (_err) {
        // isolate listener error
      }
    }
  });

  global.SchoolHubAI = {
    escapeHtml: escapeHtml,
    renderMarkdown: renderMarkdown,
    emitContext: emitContext,
    openParentAi: openParentAi,
    streamAssist: streamAssist,
    generateQuiz: generateQuiz,
    generateCards: generateCards,
    evaluateWriting: evaluateWriting,
    onHostCommand: onHostCommand,
  };
})(window);
