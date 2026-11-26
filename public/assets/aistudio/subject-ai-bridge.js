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
        if (/^---+$/.test(line.trim())) {
          return '<hr style="border:none;border-top:1px dashed rgba(148,163,184,0.45);margin:10px 0">';
        }
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

  async function fallbackNonStreamAssist(opts, body, externalSignal) {
    var fallbackCtrl = createRequestSignal(externalSignal, 55000);
    try {
      var res = await global.fetch('/api/ai/subject-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: fallbackCtrl.signal,
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        var msg = data.error || 'Không thể kết nối Trợ lý AI (HTTP ' + res.status + ').';
        throw new Error(msg);
      }
      var text = String(data.text || '').trim();
      if (!text) {
        throw new Error(data.error || 'Trợ lý AI chưa trả về nội dung phù hợp.');
      }
      if (typeof opts.onDelta === 'function') opts.onDelta(text, text);
      if (typeof opts.onDone === 'function') opts.onDone(text);
      return text;
    } catch (err) {
      if (fallbackCtrl.didTimeout()) {
        throw new Error('Yêu cầu Trợ lý AI vượt quá thời gian chờ phản hồi. Vui lòng thử lại sau vài giây.');
      }
      throw err;
    } finally {
      fallbackCtrl.cleanup();
    }
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

    var reqCtrl = createRequestSignal(opts.signal, 55000);
    var allowJsonFallback = true;
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
        var errMsg = errData.error || 'Không thể kết nối Trợ lý AI (HTTP ' + response.status + ').';
        if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 429) {
          allowJsonFallback = false;
        }
        throw new Error(errMsg);
      }

      if (contentType.indexOf('text/event-stream') !== -1 && response.body && response.body.getReader) {
        var reader = response.body.getReader();
        var decoder = new TextDecoder('utf-8');
        var buffer = '';
        var fullText = '';

        while (true) {
          var step = await reader.read();
          if (step.done) {
            buffer += decoder.decode();
            break;
          }
          buffer += decoder.decode(step.value, { stream: true });
          var parsed = parseSseBuffer(buffer);
          buffer = parsed.remainder;
          for (var i = 0; i < parsed.events.length; i++) {
            var ev = parsed.events[i];
            if (ev.error) {
              throw new Error(ev.error);
            }
            if (typeof ev.replace === 'string' && ev.replace) {
              fullText = ev.replace;
              if (typeof opts.onDelta === 'function') opts.onDelta('', fullText);
            }
            if (typeof ev.delta === 'string' && ev.delta) {
              fullText += ev.delta;
              if (typeof opts.onDelta === 'function') opts.onDelta(ev.delta, fullText);
            }
            if (ev.done && typeof ev.text === 'string' && ev.text.length >= fullText.length) {
              fullText = ev.text;
            }
          }
        }

        if (buffer.trim()) {
          var tail = parseSseBuffer(buffer + '\n\n');
          for (var j = 0; j < tail.events.length; j++) {
            var tailEv = tail.events[j];
            if (tailEv.error) {
              throw new Error(tailEv.error);
            }
            if (typeof tailEv.replace === 'string' && tailEv.replace) {
              fullText = tailEv.replace;
              if (typeof opts.onDelta === 'function') opts.onDelta('', fullText);
            }
            if (typeof tailEv.delta === 'string' && tailEv.delta) {
              fullText += tailEv.delta;
              if (typeof opts.onDelta === 'function') opts.onDelta(tailEv.delta, fullText);
            }
            if (tailEv.done && typeof tailEv.text === 'string' && tailEv.text.length >= fullText.length) {
              fullText = tailEv.text;
            }
          }
        }

        var finalText = fullText.trim();
        if (!finalText) {
          throw new Error('Trợ lý AI chưa trả về nội dung phù hợp.');
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
      if (opts.signal && opts.signal.aborted) {
        throw err;
      }
      if (allowJsonFallback && !reqCtrl.didTimeout()) {
        try {
          return await fallbackNonStreamAssist(opts, body, opts.signal);
        } catch (fallbackErr) {
          var fallbackMsg = fallbackErr && fallbackErr.message ? fallbackErr.message : 'Không thể kết nối Trợ lý AI.';
          if (typeof opts.onError === 'function') opts.onError(fallbackMsg);
          throw fallbackErr;
        }
      }
      if (reqCtrl.didTimeout()) {
        var timeoutMsg = 'Yêu cầu Trợ lý AI vượt quá thời gian chờ phản hồi. Vui lòng thử lại sau vài giây.';
        if (typeof opts.onError === 'function') opts.onError(timeoutMsg);
        throw new Error(timeoutMsg);
      }
      var finalErrMsg = err && err.message ? err.message : 'Không thể kết nối Trợ lý AI.';
      if (typeof opts.onError === 'function') opts.onError(finalErrMsg);
      throw err;
    } finally {
      reqCtrl.cleanup();
    }
  }

  async function callStructured(payload) {
    var reqCtrl = createRequestSignal(null, 55000);
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

  function isDarkTheme() {
    var doc = global.document;
    if (!doc) return false;
    var root = doc.documentElement;
    var body = doc.body;
    if (root && root.dataset && root.dataset.theme === 'dark') return true;
    if (root && root.classList && root.classList.contains('dark')) return true;
    if (body && body.classList && body.classList.contains('dark')) return true;
    try {
      return Boolean(global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch (_e) {
      return false;
    }
  }

  var toastTimer = null;
  function notify(message, isError) {
    var doc = global.document;
    if (!doc || !doc.body) return;
    var msgText = String(message || '').trim();
    if (!msgText) return;

    var existing = doc.getElementById('schoolhub-ai-toast');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
    if (toastTimer !== null) {
      global.clearTimeout(toastTimer);
      toastTimer = null;
    }

    var dark = isDarkTheme();
    var el = doc.createElement('div');
    el.id = 'schoolhub-ai-toast';
    el.setAttribute('role', isError ? 'alert' : 'status');
    el.setAttribute('aria-live', isError ? 'assertive' : 'polite');
    el.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:2147483000',
      'max-width:min(420px,calc(100vw - 32px))',
      'display:flex',
      'align-items:flex-start',
      'gap:10px',
      'padding:12px 14px',
      'border-radius:14px',
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
      'font-size:13.5px',
      'line-height:1.45',
      'box-shadow:0 12px 32px rgba(15,23,42,0.22)',
      'border:1px solid ' + (isError ? (dark ? 'rgba(248,113,113,0.45)' : '#fecaca') : (dark ? 'rgba(148,163,184,0.25)' : '#e2e8f0')),
      'background:' + (isError ? (dark ? '#2b161b' : '#fef2f2') : (dark ? '#181b26' : '#ffffff')),
      'color:' + (isError ? (dark ? '#fecaca' : '#991b1b') : (dark ? '#f1f5f9' : '#1e293b')),
    ].join(';');

    var textSpan = doc.createElement('div');
    textSpan.style.flex = '1';
    textSpan.textContent = msgText;

    var closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Đóng thông báo');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = [
      'border:none',
      'background:transparent',
      'color:inherit',
      'font-size:18px',
      'line-height:1',
      'cursor:pointer',
      'padding:0 2px',
      'opacity:0.75',
    ].join(';');
    closeBtn.onclick = function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    };

    el.appendChild(textSpan);
    el.appendChild(closeBtn);
    doc.body.appendChild(el);

    toastTimer = global.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      toastTimer = null;
    }, isError ? 7000 : 4500);
  }

  function askTopic(message, defaultValue, confirmLabel) {
    var doc = global.document;
    if (!doc || !doc.body) {
      return Promise.resolve(defaultValue ? String(defaultValue).trim() : null);
    }

    return new Promise(function (resolve) {
      var prevActive = doc.activeElement;
      var dark = isDarkTheme();
      var resolved = false;

      var prevModal = doc.getElementById('schoolhub-ai-topic-modal');
      if (prevModal && prevModal.parentNode) {
        prevModal.parentNode.removeChild(prevModal);
      }

      var backdrop = doc.createElement('div');
      backdrop.id = 'schoolhub-ai-topic-modal';
      backdrop.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:2147483001',
        'background:rgba(15,23,42,0.58)',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'padding:16px',
      ].join(';');

      var dialog = doc.createElement('form');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'schoolhub-ai-topic-title');
      dialog.style.cssText = [
        'width:min(460px,100%)',
        'border-radius:18px',
        'padding:18px 20px',
        'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
        'box-shadow:0 20px 48px rgba(15,23,42,0.28)',
        'background:' + (dark ? '#181b26' : '#ffffff'),
        'color:' + (dark ? '#f1f5f9' : '#0f172a'),
        'border:1px solid ' + (dark ? 'rgba(148,163,184,0.24)' : '#e2e8f0'),
      ].join(';');

      var title = doc.createElement('label');
      title.id = 'schoolhub-ai-topic-title';
      title.htmlFor = 'schoolhub-ai-topic-input';
      title.style.cssText = 'display:block;font-size:15px;font-weight:700;line-height:1.45;margin-bottom:10px';
      title.textContent = String(message || 'Nhập chủ đề muốn AI tạo nội dung:');

      var input = doc.createElement('input');
      input.id = 'schoolhub-ai-topic-input';
      input.type = 'text';
      input.value = String(defaultValue || '');
      input.placeholder = 'Nhập chủ đề...';
      input.style.cssText = [
        'width:100%',
        'box-sizing:border-box',
        'padding:10px 12px',
        'border-radius:10px',
        'font-size:14px',
        'outline:none',
        'border:1px solid ' + (dark ? '#3b4254' : '#cbd5e1'),
        'background:' + (dark ? '#0f121a' : '#f8fafc'),
        'color:' + (dark ? '#f8fafc' : '#0f172a'),
      ].join(';');

      var actions = doc.createElement('div');
      actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:14px';

      var cancelBtn = doc.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Hủy';
      cancelBtn.style.cssText = [
        'padding:8px 14px',
        'border-radius:10px',
        'font-size:13.5px',
        'font-weight:600',
        'cursor:pointer',
        'border:1px solid ' + (dark ? '#3b4254' : '#cbd5e1'),
        'background:transparent',
        'color:' + (dark ? '#cbd5e1' : '#334155'),
      ].join(';');

      var okBtn = doc.createElement('button');
      okBtn.type = 'submit';
      okBtn.textContent = String(confirmLabel || 'Tạo bằng AI');
      okBtn.style.cssText = [
        'padding:8px 16px',
        'border-radius:10px',
        'font-size:13.5px',
        'font-weight:600',
        'cursor:pointer',
        'border:none',
        'background:#4f46e5',
        'color:#ffffff',
      ].join(';');

      function finish(val) {
        if (resolved) return;
        resolved = true;
        doc.removeEventListener('keydown', onKeyDown, true);
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        if (prevActive && typeof prevActive.focus === 'function') {
          try {
            prevActive.focus();
          } catch (_e) {
            // ignore
          }
        }
        resolve(val);
      }

      function onKeyDown(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          finish(null);
        }
      }

      cancelBtn.onclick = function () {
        finish(null);
      };
      backdrop.onclick = function (e) {
        if (e.target === backdrop) finish(null);
      };
      dialog.onsubmit = function (e) {
        e.preventDefault();
        var val = String(input.value || '').trim();
        finish(val || null);
      };

      actions.appendChild(cancelBtn);
      actions.appendChild(okBtn);
      dialog.appendChild(title);
      dialog.appendChild(input);
      dialog.appendChild(actions);
      backdrop.appendChild(dialog);
      doc.body.appendChild(backdrop);
      doc.addEventListener('keydown', onKeyDown, true);

      global.setTimeout(function () {
        try {
          input.focus();
          input.select();
        } catch (_e) {
          // ignore
        }
      }, 0);
    });
  }

  var hostContext = {
    theme: '',
    presetClasses: [],
    classes: [],
    userName: '',
    userRole: '',
  };

  function getPresetClasses() {
    var seen = {};
    var out = [];
    var combined = []
      .concat(Array.isArray(hostContext.classes) ? hostContext.classes : [])
      .concat(Array.isArray(hostContext.presetClasses) ? hostContext.presetClasses : []);
    for (var i = 0; i < combined.length; i++) {
      var v = String(combined[i] || '').trim();
      if (v && !seen[v.toLowerCase()]) {
        seen[v.toLowerCase()] = true;
        out.push(v);
      }
    }
    return out;
  }

  function emitStats(statsPayload) {
    if (!hasParentWindow() || !statsPayload || !statsPayload.subjectId) return false;
    global.parent.postMessage(
      {
        source: 'schoolhub-subject',
        type: 'subject:stats',
        payload: {
          subjectId: String(statsPayload.subjectId),
          completedCount: Number(statsPayload.completedCount || 0) || 0,
          totalCount: Number(statsPayload.totalCount || 0) || 0,
          scoreLabel: String(statsPayload.scoreLabel || ''),
          customTopicsCount: Number(statsPayload.customTopicsCount || 0) || 0,
        },
      },
      '*'
    );
    return true;
  }

  function confirmAction(message, confirmLabel, danger) {
    var doc = global.document;
    if (!doc || !doc.body) return Promise.resolve(true);

    return new Promise(function (resolve) {
      var prevModal = doc.getElementById('schoolhub-ai-confirm-modal');
      if (prevModal && prevModal.parentNode) prevModal.parentNode.removeChild(prevModal);

      var dark = isDarkTheme();
      var resolved = false;

      var backdrop = doc.createElement('div');
      backdrop.id = 'schoolhub-ai-confirm-modal';
      backdrop.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:2147483002',
        'background:rgba(15,23,42,0.58)',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'padding:16px',
      ].join(';');

      var dialog = doc.createElement('div');
      dialog.setAttribute('role', 'alertdialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.style.cssText = [
        'width:min(400px,100%)',
        'border-radius:18px',
        'padding:18px 20px',
        'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
        'box-shadow:0 20px 48px rgba(15,23,42,0.28)',
        'background:' + (dark ? '#181b26' : '#ffffff'),
        'color:' + (dark ? '#f1f5f9' : '#0f172a'),
        'border:1px solid ' + (dark ? 'rgba(148,163,184,0.24)' : '#e2e8f0'),
      ].join(';');

      var msgEl = doc.createElement('div');
      msgEl.style.cssText = 'font-size:14px;font-weight:600;line-height:1.5;margin-bottom:14px';
      msgEl.textContent = String(message || 'Xác nhận thao tác này?');

      var actions = doc.createElement('div');
      actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px';

      var cancelBtn = doc.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Hủy';
      cancelBtn.style.cssText = [
        'padding:8px 14px',
        'border-radius:10px',
        'font-size:13px',
        'font-weight:600',
        'cursor:pointer',
        'border:1px solid ' + (dark ? '#3b4254' : '#cbd5e1'),
        'background:transparent',
        'color:' + (dark ? '#cbd5e1' : '#334155'),
      ].join(';');

      var okBtn = doc.createElement('button');
      okBtn.type = 'button';
      okBtn.textContent = String(confirmLabel || 'Xác nhận');
      okBtn.style.cssText = [
        'padding:8px 16px',
        'border-radius:10px',
        'font-size:13px',
        'font-weight:600',
        'cursor:pointer',
        'border:none',
        'background:' + (danger === false ? '#0284c7' : '#dc2626'),
        'color:#ffffff',
      ].join(';');

      function done(val) {
        if (resolved) return;
        resolved = true;
        doc.removeEventListener('keydown', onKey, true);
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        resolve(val);
      }

      function onKey(e) {
        if (e.key === 'Escape') done(false);
      }

      cancelBtn.onclick = function () { done(false); };
      okBtn.onclick = function () { done(true); };
      backdrop.onclick = function (e) { if (e.target === backdrop) done(false); };
      doc.addEventListener('keydown', onKey, true);

      actions.appendChild(cancelBtn);
      actions.appendChild(okBtn);
      dialog.appendChild(msgEl);
      dialog.appendChild(actions);
      backdrop.appendChild(dialog);
      doc.body.appendChild(backdrop);
      global.setTimeout(function () { try { okBtn.focus(); } catch (_e) {} }, 0);
    });
  }

  async function downloadSubjectTemplate(subjectId, moduleKey, extraClasses) {
    var clsList = getPresetClasses();
    if (Array.isArray(extraClasses)) {
      for (var i = 0; i < extraClasses.length; i++) {
        var c = String(extraClasses[i] || '').trim();
        if (c && clsList.indexOf(c) === -1) clsList.push(c);
      }
    }
    var params = new URLSearchParams();
    params.set('subject', String(subjectId || 'english'));
    if (moduleKey) params.set('module', String(moduleKey));
    if (clsList.length > 0) params.set('classes', clsList.join(','));

    var url = '/api/subjects/excel-template?' + params.toString();
    var resp = await global.fetch(url);
    if (!resp.ok) {
      var err = await resp.json().catch(function () { return {}; });
      throw new Error(err.error || 'Không thể tải tệp Excel mẫu.');
    }
    var blob = await resp.blob();
    var cd = resp.headers.get('content-disposition') || '';
    var match = cd.match(/filename="?([^"]+)"?/i);
    var fileName = match ? match[1] : ('Mau_' + subjectId + '_' + (moduleKey || 'data') + '.xlsx');
    var objUrl = global.URL.createObjectURL(blob);
    var a = global.document.createElement('a');
    a.href = objUrl;
    a.download = fileName;
    global.document.body.appendChild(a);
    a.click();
    global.document.body.removeChild(a);
    global.setTimeout(function () { global.URL.revokeObjectURL(objUrl); }, 1000);
    notify('Đã tải file mẫu Excel (' + fileName + ') kèm Sheet tab & Drop-down list.');
    return fileName;
  }

  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var res = String(reader.result || '');
        var idx = res.indexOf(',');
        resolve(idx >= 0 ? res.slice(idx + 1) : res);
      };
      reader.onerror = function () {
        reject(new Error('Không thể đọc tệp từ máy tính.'));
      };
      reader.readAsDataURL(file);
    });
  }

  function syncClassesToHost(subjectId, classNames, source) {
    if (!hasParentWindow() || !subjectId || !Array.isArray(classNames)) return false;
    var seen = {};
    var normalized = [];
    for (var i = 0; i < classNames.length; i++) {
      var val = String(classNames[i] || '').trim();
      if (val && !seen[val.toLowerCase()]) {
        seen[val.toLowerCase()] = true;
        normalized.push(val);
      }
    }
    if (normalized.length === 0) return false;
    global.parent.postMessage(
      {
        source: 'schoolhub-subject',
        type: 'subject:sync-classes',
        payload: {
          subjectId: String(subjectId),
          classNames: normalized,
          source: String(source || 'excel-import'),
        },
      },
      '*'
    );
    return true;
  }

  async function parseSubjectExcelFile(subjectId, moduleKey, file, opts) {
    var base64 = await readFileAsBase64(file);
    var resp = await global.fetch('/api/subjects/parse-excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectId: String(subjectId || 'english'),
        moduleKey: String(moduleKey || ''),
        fileBase64: base64,
        title: (opts && opts.title) || (file && file.name ? file.name.replace(/\.[^.]+$/, '') : ''),
        presetClasses: getPresetClasses(),
      }),
    });
    var data = await resp.json().catch(function () { return {}; });
    if (!resp.ok) {
      throw new Error(data.error || 'Không thể đọc dữ liệu từ tệp Excel.');
    }
    var discovered = Array.isArray(data.discoveredClasses) ? data.discoveredClasses.slice() : [];
    if (Array.isArray(data.rows)) {
      for (var i = 0; i < data.rows.length; i++) {
        var r = data.rows[i];
        var cls = r && (r.className || r['Lớp áp dụng'] || r['Lớp']);
        if (cls && discovered.indexOf(String(cls).trim()) === -1) {
          discovered.push(String(cls).trim());
        }
      }
    }
    if (discovered.length > 0) {
      data.discoveredClasses = discovered;
      syncClassesToHost(subjectId, discovered, 'excel-import');
    }
    return data;
  }

  async function exportSubjectExcel(subjectId, moduleKey, records, fileName) {
    var rows = Array.isArray(records) ? records : [];
    var discovered = [];
    for (var i = 0; i < rows.length; i++) {
      var cls = rows[i] && (rows[i].className || rows[i]['Lớp áp dụng']);
      if (cls) {
        var trimmed = String(cls).trim();
        if (trimmed && discovered.indexOf(trimmed) === -1) discovered.push(trimmed);
      }
    }
    if (discovered.length > 0) {
      syncClassesToHost(subjectId, discovered, 'excel-export');
    }
    var resp = await global.fetch('/api/subjects/export-excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectId: String(subjectId || 'english'),
        moduleKey: String(moduleKey || ''),
        records: rows,
        presetClasses: getPresetClasses(),
        fileName: fileName || '',
      }),
    });
    if (!resp.ok) {
      var err = await resp.json().catch(function () { return {}; });
      throw new Error(err.error || 'Không thể xuất tệp Excel.');
    }
    var blob = await resp.blob();
    var cd = resp.headers.get('content-disposition') || '';
    var match = cd.match(/filename="?([^"]+)"?/i);
    var outName = match ? match[1] : ('Xuat_' + subjectId + '_' + (moduleKey || 'data') + '.xlsx');
    var objUrl = global.URL.createObjectURL(blob);
    var a = global.document.createElement('a');
    a.href = objUrl;
    a.download = outName;
    global.document.body.appendChild(a);
    a.click();
    global.document.body.removeChild(a);
    global.setTimeout(function () { global.URL.revokeObjectURL(objUrl); }, 1000);
    notify('Đã xuất Excel (' + outName + ') kèm Sheet tab & Drop-down list.');
    return outName;
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
    if (msg.type === 'host:context' && msg.payload) {
      if (msg.payload.theme === 'dark' || msg.payload.theme === 'light') {
        hostContext.theme = msg.payload.theme;
        if (global.document && global.document.documentElement) {
          global.document.documentElement.setAttribute('data-theme', msg.payload.theme);
          global.document.documentElement.style.colorScheme = msg.payload.theme;
        }
      }
      if (Array.isArray(msg.payload.presetClasses)) hostContext.presetClasses = msg.payload.presetClasses;
      if (Array.isArray(msg.payload.classes)) hostContext.classes = msg.payload.classes;
      if (msg.payload.userName) hostContext.userName = String(msg.payload.userName);
      if (msg.payload.userRole) hostContext.userRole = String(msg.payload.userRole);
    }
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](msg);
      } catch (_err) {
        // isolate listener error
      }
    }
  });

  var GAUTH_URL = 'https://www.gauth.com/';

  function ensureGauthPanelStyles(doc) {
    if (!doc || !doc.head || doc.getElementById('schoolhub-gauth-style')) return;
    var styleEl = doc.createElement('style');
    styleEl.id = 'schoolhub-gauth-style';
    styleEl.textContent = [
      '.sh-gauth-shell{display:flex;flex-direction:column;height:calc(100vh - 118px);min-height:560px;border-radius:18px;overflow:hidden;border:1px solid #dbe4f0;background:#ffffff;color:#0f172a;box-shadow:0 8px 24px rgba(15,23,42,0.08);}',
      '.sh-gauth-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #e2e8f0;background:#f8fafc;}',
      '.sh-gauth-title-wrap{display:flex;align-items:center;gap:10px;min-width:0;}',
      '.sh-gauth-badge{width:30px;height:30px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;background:#0284c7;color:#ffffff;flex-shrink:0;}',
      '.sh-gauth-title{font-size:14px;font-weight:700;line-height:1.25;margin:0;color:#0f172a;}',
      '.sh-gauth-sub{font-size:12px;color:#475569;margin-top:1px;word-break:break-all;}',
      '.sh-gauth-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
      '.sh-gauth-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:7px 12px;border-radius:10px;font-size:12.5px;font-weight:600;line-height:1.2;text-decoration:none !important;cursor:pointer;white-space:nowrap;transition:opacity 0.15s ease,transform 0.15s ease;}',
      '.sh-gauth-btn:hover{opacity:0.92;transform:none;}',
      '.sh-gauth-btn-ghost{background:#ffffff !important;color:#1e293b !important;border:1px solid #cbd5e1 !important;box-shadow:none !important;}',
      '.sh-gauth-btn-primary{background:#0284c7 !important;color:#ffffff !important;border:1px solid #0284c7 !important;box-shadow:none !important;}',
      '.sh-gauth-frame-wrap{position:relative;flex:1;min-height:480px;background:#ffffff;}',
      '.sh-gauth-frame{width:100%;height:100%;min-height:480px;border:0;display:block;background:#ffffff;}',
      ':root[data-theme="dark"] .sh-gauth-shell{border-color:#334155;background:#0f172a;color:#f1f5f9;}',
      ':root[data-theme="dark"] .sh-gauth-bar{border-bottom-color:#334155;background:#1e293b;}',
      ':root[data-theme="dark"] .sh-gauth-title{color:#f8fafc;}',
      ':root[data-theme="dark"] .sh-gauth-sub{color:#cbd5e1;}',
      ':root[data-theme="dark"] .sh-gauth-btn-ghost{background:#0f172a !important;color:#f1f5f9 !important;border-color:#475569 !important;}',
      ':root[data-theme="dark"] .sh-gauth-frame-wrap,:root[data-theme="dark"] .sh-gauth-frame{background:#0f172a;}',
      '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .sh-gauth-shell{border-color:#334155;background:#0f172a;color:#f1f5f9;}:root:not([data-theme="light"]) .sh-gauth-bar{border-bottom-color:#334155;background:#1e293b;}:root:not([data-theme="light"]) .sh-gauth-title{color:#f8fafc;}:root:not([data-theme="light"]) .sh-gauth-sub{color:#cbd5e1;}:root:not([data-theme="light"]) .sh-gauth-btn-ghost{background:#0f172a !important;color:#f1f5f9 !important;border-color:#475569 !important;}:root:not([data-theme="light"]) .sh-gauth-frame-wrap,:root:not([data-theme="light"]) .sh-gauth-frame{background:#0f172a;}}',
    ].join('\n');
    doc.head.appendChild(styleEl);
  }

  function renderGauthPanel(container, options) {
    var doc = global.document;
    if (!doc || !container) return null;
    ensureGauthPanelStyles(doc);

    var opts = options || {};
    var subjectName = String(opts.subjectName || 'Môn học').trim();
    var targetUrl = String(opts.url || GAUTH_URL);

    var existing = container.querySelector('[data-gauth-panel="1"]');
    if (existing && existing.getAttribute('data-gauth-url') === targetUrl) {
      return existing;
    }

    container.innerHTML = '';

    var shell = doc.createElement('div');
    shell.className = 'sh-gauth-shell';
    shell.setAttribute('data-gauth-panel', '1');
    shell.setAttribute('data-gauth-url', targetUrl);

    var bar = doc.createElement('div');
    bar.className = 'sh-gauth-bar';

    var titleWrap = doc.createElement('div');
    titleWrap.className = 'sh-gauth-title-wrap';

    var badge = doc.createElement('span');
    badge.className = 'sh-gauth-badge';
    badge.textContent = 'G';

    var titleTextWrap = doc.createElement('div');
    var heading = doc.createElement('div');
    heading.className = 'sh-gauth-title';
    heading.textContent = 'Gauth · ' + subjectName;

    var sub = doc.createElement('div');
    sub.className = 'sh-gauth-sub';
    sub.textContent = targetUrl;

    titleTextWrap.appendChild(heading);
    titleTextWrap.appendChild(sub);
    titleWrap.appendChild(badge);
    titleWrap.appendChild(titleTextWrap);

    var actions = doc.createElement('div');
    actions.className = 'sh-gauth-actions';

    var reloadBtn = doc.createElement('button');
    reloadBtn.type = 'button';
    reloadBtn.className = 'sh-gauth-btn sh-gauth-btn-ghost';
    reloadBtn.setAttribute('data-gauth-reload', '1');
    reloadBtn.textContent = 'Tải lại';

    var openLink = doc.createElement('a');
    openLink.className = 'sh-gauth-btn sh-gauth-btn-primary';
    openLink.href = targetUrl;
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';
    openLink.textContent = 'Mở ở tab mới';

    actions.appendChild(reloadBtn);
    actions.appendChild(openLink);

    bar.appendChild(titleWrap);
    bar.appendChild(actions);

    var frameWrap = doc.createElement('div');
    frameWrap.className = 'sh-gauth-frame-wrap';

    var iframe = doc.createElement('iframe');
    iframe.className = 'sh-gauth-frame';
    iframe.src = targetUrl;
    iframe.title = 'Gauth - ' + subjectName;
    iframe.setAttribute('allow', 'clipboard-write; clipboard-read; camera; microphone');
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');

    reloadBtn.onclick = function () {
      iframe.src = targetUrl;
    };

    frameWrap.appendChild(iframe);
    shell.appendChild(bar);
    shell.appendChild(frameWrap);
    container.appendChild(shell);
    return shell;
  }

  global.SchoolHubAI = {
    GAUTH_URL: GAUTH_URL,
    escapeHtml: escapeHtml,
    renderMarkdown: renderMarkdown,
    emitContext: emitContext,
    emitStats: emitStats,
    openParentAi: openParentAi,
    streamAssist: streamAssist,
    generateQuiz: generateQuiz,
    generateCards: generateCards,
    evaluateWriting: evaluateWriting,
    onHostCommand: onHostCommand,
    askTopic: askTopic,
    confirmAction: confirmAction,
    notify: notify,
    hostContext: hostContext,
    getPresetClasses: getPresetClasses,
    downloadSubjectTemplate: downloadSubjectTemplate,
    parseSubjectExcelFile: parseSubjectExcelFile,
    exportSubjectExcel: exportSubjectExcel,
    syncClassesToHost: syncClassesToHost,
    renderGauthPanel: renderGauthPanel,
  };
})(window);
