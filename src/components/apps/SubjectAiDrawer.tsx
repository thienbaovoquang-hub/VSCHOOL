import React, { useEffect, useRef, useState } from 'react';
import { Bot, ImagePlus, Send, Trash2, X } from '../icons/UiIcons';
import { SubjectId } from '../../utils/subjectRegistry';
import {
  getSubjectAiPresets,
  SUBJECT_AI_PROFILES,
  SubjectAiChatTurn,
  SubjectAiMode,
  SubjectBridgeContextPayload,
  VALID_SUBJECT_IDS,
} from '../../utils/subjectAi';
import { FormattedAiText } from '../common/FormattedAiText';

interface SubjectAiMessage extends SubjectAiChatTurn {
  id: string;
  isError?: boolean;
}

interface AttachedImage {
  name: string;
  mimeType: string;
  dataBase64: string;
}

export type HostToIframeCommand =
  | { type: 'iframe:navigate'; view: string; topicId?: string }
  | { type: 'iframe:set-filter'; filterKey: string; filterValue: string };

export interface PendingSubjectAiRequest {
  id: string;
  subjectId: SubjectId;
  mode?: SubjectAiMode;
  prompt?: string;
  contextText?: string;
  autoSend?: boolean;
}

export interface SubjectAiDrawerProps {
  isOpen: boolean;
  subjectId: SubjectId;
  onChangeSubject?: (subjectId: SubjectId) => void;
  allowSubjectSwitch?: boolean;
  liveContext?: SubjectBridgeContextPayload | null;
  pendingRequest?: PendingSubjectAiRequest | null;
  onConsumePendingRequest?: (id: string) => void;
  onSendCommandToIframe?: (command: HostToIframeCommand) => boolean;
  onClose: () => void;
}

const MODE_LABELS: Array<{ value: SubjectAiMode; label: string }> = [
  { value: 'tutor_chat', label: 'Hỏi đáp gia sư' },
  { value: 'solve_step_by_step', label: 'Giải bài từng bước' },
  { value: 'wrong_answer_coach', label: 'Giải thích lỗi sai' },
  { value: 'similar_problems', label: 'Tạo bài tương tự' },
  { value: 'writing_outline', label: 'Hướng dẫn dàn ý' },
  { value: 'writing_feedback', label: 'Nhận xét bài viết' },
  { value: 'grammar_check', label: 'Sửa lỗi Tiếng Anh' },
  { value: 'event_analysis', label: 'Phân tích sự kiện Sử' },
  { value: 'figure_role', label: 'Vai trò nhân vật Sử' },
  { value: 'period_compare', label: 'So sánh thời kỳ / phong trào' },
  { value: 'mindmap_timeline', label: 'Bảng tổng hợp & Sơ đồ tư duy' },
  { value: 'chart_analysis', label: 'Phân tích bản đồ & biểu đồ' },
  { value: 'geo_calc', label: 'Tính chỉ số địa lý' },
  { value: 'phenomenon_analysis', label: 'Phân tích hiện tượng địa lý' },
  { value: 'exam_guide', label: 'Phương pháp làm bài thi' },
  { value: 'quiz_generate', label: 'Tạo câu hỏi ôn tập' },
];

function renderFormattedLine(line: string, lineKey: string): React.ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return (
    <React.Fragment key={lineKey}>
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <strong key={`${lineKey}-${idx}`} className="font-semibold text-slate-900 dark:text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <React.Fragment key={`${lineKey}-${idx}`}>{part}</React.Fragment>;
      })}
    </React.Fragment>
  );
}

function renderFormattedText(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, index) => (
    <React.Fragment key={`line-${index}`}>
      {renderFormattedLine(line, `line-${index}`)}
      {index < lines.length - 1 ? <br /> : null}
    </React.Fragment>
  ));
}

function readFileAsBase64(file: File): Promise<AttachedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        mimeType: file.type || 'image/png',
        dataBase64: String(reader.result || ''),
      });
    };
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'));
    reader.readAsDataURL(file);
  });
}

export const SubjectAiDrawer: React.FC<SubjectAiDrawerProps> = ({
  isOpen,
  subjectId,
  onChangeSubject,
  allowSubjectSwitch = false,
  liveContext,
  pendingRequest,
  onConsumePendingRequest,
  onClose,
}) => {
  const [mode, setMode] = useState<SubjectAiMode>('tutor_chat');
  const [input, setInput] = useState('');
  const [messagesBySubject, setMessagesBySubject] = useState<Record<string, SubjectAiMessage[]>>({});
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  const profile = SUBJECT_AI_PROFILES[subjectId];
  const presets = getSubjectAiPresets(subjectId);
  const messages = messagesBySubject[subjectId] || [];

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages.length, subjectId]);

  useEffect(() => {
    if (pendingRequest && isOpen) {
      if (pendingRequest.mode) {
        setMode(pendingRequest.mode);
      }
      if (pendingRequest.prompt) {
        setInput(pendingRequest.prompt);
        if (pendingRequest.autoSend) {
          const promptToSend = pendingRequest.prompt;
          const modeToSend = pendingRequest.mode ?? mode;
          const ctxToSend = pendingRequest.contextText || (liveContext ? [liveContext.view ? `Mục: ${liveContext.view}` : '', liveContext.topic, liveContext.summary].filter(Boolean).join('\n') : '');
          onConsumePendingRequest?.(pendingRequest.id);
          setTimeout(() => {
            void sendPrompt(promptToSend, modeToSend, ctxToSend);
          }, 100);
          return;
        }
      }
      onConsumePendingRequest?.(pendingRequest.id);
    }
  }, [pendingRequest, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const encoded = await readFileAsBase64(file);
      setAttachedImage(encoded);
    } catch {
      setMessagesBySubject((prev) => ({
        ...prev,
        [subjectId]: [
          ...(prev[subjectId] || []),
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: 'Không đọc được tệp ảnh đính kèm. Vui lòng chọn ảnh PNG, JPEG hoặc WebP.',
            isError: true,
          },
        ],
      }));
    }
  };

  const handleClear = () => {
    setMessagesBySubject((prev) => ({ ...prev, [subjectId]: [] }));
    setAttachedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendPrompt = async (customPrompt?: string, overrideMode?: SubjectAiMode, customContextText?: string) => {
    if (isLoading) return;
    const textToSend = (customPrompt ?? input).trim();
    const activeMode = overrideMode ?? mode;
    if (!textToSend && !attachedImage) return;

    const userMessage: SubjectAiMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: textToSend || `(Đính kèm ảnh: ${attachedImage?.name || 'bài tập'})`,
    };

    const existingTurns: SubjectAiChatTurn[] = (messagesBySubject[subjectId] || [])
      .filter((item) => !item.isError)
      .slice(-8)
      .map((item) => ({ role: item.role, content: item.content }));

    const nextTurns: SubjectAiChatTurn[] = [
      ...existingTurns,
      { role: 'user', content: userMessage.content },
    ];

    const imageToSend = attachedImage
      ? { mimeType: attachedImage.mimeType, dataBase64: attachedImage.dataBase64 }
      : null;

    const contextTextToSend = customContextText !== undefined
      ? customContextText
      : liveContext
        ? [liveContext.view ? `Mục: ${liveContext.view}` : '', liveContext.topic, liveContext.summary].filter(Boolean).join('\n')
        : '';

    setMessagesBySubject((prev) => ({
      ...prev,
      [subjectId]: [...(prev[subjectId] || []), userMessage],
    }));
    if (customPrompt === undefined) {
      setInput('');
    }
    setAttachedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsLoading(true);

    const assistantId = `a-${Date.now()}`;
    setStreamingMsgId(assistantId);
    const upsertAssistantMessage = (content: string, isError = false) => {
      setMessagesBySubject((prev) => {
        const list = prev[subjectId] || [];
        const exists = list.some((m) => m.id === assistantId);
        if (exists) {
          return {
            ...prev,
            [subjectId]: list.map((m) =>
              m.id === assistantId ? { ...m, content, isError } : m
            ),
          };
        }
        return {
          ...prev,
          [subjectId]: [
            ...list,
            { id: assistantId, role: 'assistant', content, isError },
          ],
        };
      });
    };

    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 65_000);

    try {
      const payload = {
        subjectId,
        mode: activeMode,
        messages: nextTurns,
        contextText: contextTextToSend,
        image: imageToSend,
      };

      const response = await fetch('/api/ai/subject-assist-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const fallbackNonStream = async (): Promise<string | null> => {
        const res = await fetch('/api/ai/subject-assist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const fallbackText = String(data.text || '').trim();
        if (!res.ok || !fallbackText) {
          throw new Error(String(data.error || 'Không thể kết nối Trợ lý AI lúc này.'));
        }
        return fallbackText;
      };

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const shouldFallback =
          !data?.exhaustedFallback && ![400, 401, 403, 429].includes(response.status);
        if (shouldFallback) {
          try {
            const fbText = await fallbackNonStream();
            if (fbText) {
              upsertAssistantMessage(fbText, false);
              return;
            }
          } catch (fbErr) {
            upsertAssistantMessage(
              fbErr instanceof Error ? fbErr.message : String(data.error || 'Không thể kết nối Trợ lý AI lúc này.'),
              true
            );
            return;
          }
        }
        upsertAssistantMessage(
          data.error || 'Không thể kết nối Trợ lý AI lúc này.',
          true
        );
        return;
      }

      if (contentType.includes('text/event-stream') && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullText = '';

        const consumeBlocks = (blocks: string[]) => {
          for (const block of blocks) {
            const dataLines = block
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trimStart());
            if (!dataLines.length) continue;
            const rawJson = dataLines.join('\n').trim();
            if (!rawJson || rawJson === '[DONE]') continue;
            let ev: { delta?: string; replace?: string; done?: boolean; text?: string; error?: string } | null = null;
            try {
              ev = JSON.parse(rawJson) as { delta?: string; replace?: string; done?: boolean; text?: string; error?: string };
            } catch {
              continue;
            }
            if (!ev) continue;
            if (ev.error) {
              throw new Error(ev.error);
            }
            if (typeof ev.replace === 'string' && ev.replace) {
              fullText = ev.replace;
              upsertAssistantMessage(fullText, false);
            }
            if (typeof ev.delta === 'string' && ev.delta) {
              fullText += ev.delta;
              upsertAssistantMessage(fullText, false);
            }
            if (ev.done && typeof ev.text === 'string' && ev.text.length >= fullText.length) {
              fullText = ev.text;
              upsertAssistantMessage(fullText, false);
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
          if (!fullText.trim() && !timedOut) {
            const fbText = await fallbackNonStream();
            if (fbText) {
              upsertAssistantMessage(fbText, false);
              return;
            }
          }
          throw streamErr;
        }

        if (!fullText.trim()) {
          if (!timedOut) {
            const fbText = await fallbackNonStream();
            if (fbText) {
              upsertAssistantMessage(fbText, false);
              return;
            }
          }
          upsertAssistantMessage('Trợ lý AI chưa trả về nội dung phù hợp.', true);
        }
        return;
      }

      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const text = String(data.text || '').trim();
      if (!text) {
        upsertAssistantMessage(String(data.error || 'Trợ lý AI chưa trả về nội dung phù hợp.'), true);
        return;
      }
      upsertAssistantMessage(text, false);
    } catch (error) {
      if (timedOut) {
        upsertAssistantMessage(
          'Yêu cầu Trợ lý AI vượt quá thời gian chờ phản hồi. Vui lòng thử lại sau vài giây.',
          true
        );
      } else {
        const msg = error instanceof Error ? error.message : 'Lỗi kết nối máy chủ.';
        upsertAssistantMessage(`Không gọi được Trợ lý AI: ${msg}`, true);
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
      setStreamingMsgId(null);
    }
  };

  return (
    <aside
      data-testid="subject-ai-drawer"
      aria-label={profile.tutorTitle}
      className="fixed inset-y-0 right-0 sm:top-[74px] sm:bottom-3 sm:right-3 z-50 w-full sm:w-[420px] sm:rounded-[26px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col"
    >
      <div className="px-4 py-3.5 border-b border-slate-900/10 dark:border-white/10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-sky-600 dark:text-sky-300" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {profile.tutorTitle}
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
            {profile.description}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              title="Làm mới hội thoại"
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            data-testid="close-subject-ai-drawer"
            onClick={onClose}
            title="Đóng trợ lý AI"
            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {allowSubjectSwitch && onChangeSubject && (
            <select
              aria-label="Chọn môn học"
              data-testid="subject-ai-select"
              value={subjectId}
              onChange={(e) => onChangeSubject(e.target.value as SubjectId)}
              className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-xl glass-subsurface text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
            >
              {VALID_SUBJECT_IDS.map((id) => (
                <option key={id} value={id}>
                  {SUBJECT_AI_PROFILES[id].subjectName}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Chế độ hỗ trợ"
            data-testid="subject-ai-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as SubjectAiMode)}
            className="flex-1 min-w-[150px] px-2.5 py-1.5 rounded-xl glass-subsurface text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
          >
            {MODE_LABELS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
              Đặt câu hỏi trực tiếp hoặc chọn nhanh một gợi ý bên dưới. Bạn cũng có thể đính kèm ảnh đề bài để AI đọc và hướng dẫn từng bước.
            </p>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Gợi ý nhanh cho môn {profile.subjectName}
              </p>
              <div className="flex flex-col gap-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setMode(preset.mode);
                      setInput(preset.prompt);
                      requestAnimationFrame(() => textareaRef.current?.focus());
                    }}
                    className="text-left px-3 py-2.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-slate-800/75 text-xs text-slate-800 dark:text-slate-100 transition-all cursor-pointer"
                  >
                    <span className="font-semibold text-slate-900 dark:text-white block">
                      {preset.label}
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1 mt-0.5">
                      {preset.prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed ${
                msg.role === 'user'
                  ? 'ml-6 bg-sky-600 text-white shadow-sm'
                  : msg.isError
                    ? 'mr-4 bg-rose-500/15 border border-rose-400/40 text-rose-800 dark:text-rose-200'
                    : 'mr-4 glass-subsurface text-slate-900 dark:text-slate-100'
              }`}
            >
              {msg.role === 'user' ? (
                msg.content
              ) : msg.isError ? (
                renderFormattedText(msg.content)
              ) : (
                <FormattedAiText
                  text={msg.content}
                  isStreaming={isLoading && streamingMsgId === msg.id}
                />
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="mr-4 rounded-2xl px-3.5 py-2.5 text-xs glass-subsurface text-slate-600 dark:text-slate-300">
            Trợ lý AI đang phân tích nội dung {profile.subjectName}…
          </div>
        )}
        <div ref={scrollEndRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendPrompt();
        }}
        className="p-3.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2"
      >
        {attachedImage && (
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl glass-subsurface text-xs text-slate-800 dark:text-slate-100">
            <span className="truncate">Ảnh đính kèm: {attachedImage.name}</span>
            <button
              type="button"
              onClick={() => {
                setAttachedImage(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="text-slate-500 hover:text-rose-600 dark:text-slate-400 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <textarea
          ref={textareaRef}
          data-testid="subject-ai-input"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void sendPrompt();
            }
          }}
          placeholder={`Nhập câu hỏi hoặc đề bài môn ${profile.subjectName}…`}
          className="w-full rounded-xl glass-subsurface px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
        />
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-slate-800/75 text-xs font-medium text-slate-800 dark:text-slate-100 cursor-pointer whitespace-nowrap shrink-0 transition-all">
            <ImagePlus className="w-3.5 h-3.5" />
            <span>Ảnh đề bài</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleImageChange}
              className="hidden"
            />
          </label>
          <button
            type="submit"
            data-testid="subject-ai-send"
            disabled={isLoading || (!input.trim() && !attachedImage)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-all shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Đang gửi…' : 'Gửi AI'}</span>
          </button>
        </div>
      </form>
    </aside>
  );
};
