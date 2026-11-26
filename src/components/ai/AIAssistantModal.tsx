import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, Trash2, ShieldCheck, HelpCircle } from '../icons/UiIcons';
import { Modal } from '../common/Modal';
import { UserProfile } from '../../types';
import { FormattedAiText } from '../common/FormattedAiText';
import { postSseWithFallback } from '../../utils/aiStreamClient';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isError?: boolean;
}

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
}

const PROMPT_CHIPS = [
  'Hướng dẫn quy trình mượn sách bằng thẻ học sinh RFID?',
  'Tư vấn phương pháp học tập hiệu quả môn Toán & Vật lí',
  'Gợi ý ngành nghề phù hợp với học sinh giỏi tự nhiên & sáng tạo',
  'Nội quy trường học về việc sử dụng điện thoại và đồng phục',
  'Cách gửi phản ánh cơ sở vật chất ẩn danh lên Ban Giám Hiệu'
];

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  currentUser
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Xin chào ${currentUser.displayName}! Tôi là SchoolHub Copilot — Trợ lý Trí tuệ Nhân tạo hỗ trợ tra cứu thông tin, giải đáp học tập, tư vấn hướng nghiệp và hỗ trợ công tác học đường. Bạn cần trợ giúp gì hôm nay?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const historyTurns = messages
      .filter((m) => !m.isError && m.id !== 'welcome')
      .slice(-8)
      .map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));
    historyTurns.push({ role: 'user', content: query });

    const assistantMsgId = `a-${Date.now() + 1}`;
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setStreamingMsgId(assistantMsgId);

    const upsertAssistantMessage = (text: string, isError = false) => {
      const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => {
        const exists = prev.some(m => m.id === assistantMsgId);
        if (exists) {
          return prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, text, isError, timestamp: ts }
              : m
          );
        }
        return [
          ...prev,
          { id: assistantMsgId, sender: 'assistant', text, timestamp: ts, isError },
        ];
      });
    };

    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 65_000);

    try {
      const finalText = await postSseWithFallback({
        streamUrl: '/api/ai/chat-stream',
        fallbackUrl: '/api/ai/chat',
        signal: controller.signal,
        isTimedOut: () => timedOut,
        payload: {
          message: query,
          messages: historyTurns,
          user: {
            displayName: currentUser.displayName,
            role: currentUser.role,
            className: currentUser.className || currentUser.studentCode || currentUser.email || 'THPT',
          },
        },
        onUpdate: (partialText) => {
          upsertAssistantMessage(partialText, false);
        },
      });
      upsertAssistantMessage(finalText, false);
    } catch (err) {
      console.error('AI query error', err);
      upsertAssistantMessage(
        timedOut
          ? 'Yêu cầu tới Trợ lý AI vượt quá thời gian chờ phản hồi. Vui lòng thử lại sau giây lát.'
          : err instanceof Error && err.message
            ? err.message
            : 'Không thể kết nối đến máy chủ AI lúc này. Vui lòng thử lại sau giây lát.',
        true
      );
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
      setStreamingMsgId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="SchoolHub AI Copilot"
      description="Trợ lý trí tuệ nhân tạo hỗ trợ học tập, hướng nghiệp và tra cứu học đường"
      maxWidth="3xl"
    >
      <div className="flex flex-col h-[540px]">
        {/* Suggestion Prompt Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/35 dark:border-white/10 mb-3 text-xs scrollbar-none">
          <HelpCircle className="w-4 h-4 text-sky-500 shrink-0" />
          <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Gợi ý:</span>
          {PROMPT_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(chip)}
              className="px-2.5 py-1 rounded-full glass-subsurface hover:text-sky-700 dark:hover:text-sky-300 text-slate-700 dark:text-slate-200 shrink-0 transition-all text-left cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Chat History */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3.5 pr-2">
          {messages.map(msg => {
            const isMe = msg.sender === 'user';
            return (
              <div key={msg.id} className={`flex gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && (
                  <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                  isMe
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-500/15'
                    : msg.isError
                      ? 'bg-rose-500/15 border border-rose-400/40 text-rose-800 dark:text-rose-200 shadow-xs'
                      : 'glass-subsurface text-slate-800 dark:text-slate-100 shadow-xs'
                }`}>
                  {!isMe && !msg.isError ? (
                    <FormattedAiText
                      text={msg.text}
                      isStreaming={isLoading && streamingMsgId === msg.id}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                    <div className={`text-[10px] font-mono-tabular ${isMe ? 'text-white/75 text-right' : 'text-slate-500 dark:text-slate-400'}`}>
                      {msg.timestamp}
                    </div>
                  </div>
                </div>

                {isMe && (
                  <div className="w-8 h-8 rounded-xl bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && !messages.some(m => m.id === streamingMsgId) && (
            <div className="flex gap-3 items-center text-xs text-slate-400">
              <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center text-white shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="glass-subsurface px-4 py-2.5 rounded-2xl flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce [animation-delay:0.4s]" />
                <span className="text-slate-600 dark:text-slate-300 ml-1">Copilot đang trả lời...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="pt-3 border-t border-white/35 dark:border-white/10 mt-2">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Nhập câu hỏi hoặc yêu cầu hỗ trợ học đường..."
              className="flex-1 glass-subsurface rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Gửi tin nhắn"
              className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-40 shadow-sm transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 px-1">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Bảo mật danh tính & xử lý AI phía máy chủ
            </span>
            <button
              type="button"
              onClick={() => setMessages([messages[0]])}
              className="hover:text-rose-600 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" /> Xóa hội thoại
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
