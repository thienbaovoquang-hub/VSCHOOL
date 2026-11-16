import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, Trash2, ShieldCheck, HelpCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { UserProfile } from '../../types';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
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
      id: String(Date.now()),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          user: {
            displayName: currentUser.displayName,
            role: currentUser.role,
            className: currentUser.className || currentUser.studentCode || currentUser.email || 'THPT',
          },
        }),
      });

      const data = await response.json();
      const replyText = response.ok && data?.text
        ? String(data.text)
        : (data?.error ? String(data.error) : 'Xin lỗi, chưa nhận được phản hồi từ máy chủ AI.');

      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'assistant',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err) {
      console.error('AI query error', err);
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'assistant',
          text: 'Không thể kết nối đến máy chủ AI lúc này. Vui lòng thử lại sau giây lát.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
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
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200/50 dark:border-slate-700/60 mb-3 text-xs scrollbar-none">
          <HelpCircle className="w-4 h-4 text-sky-500 shrink-0" />
          <span className="text-slate-400 font-medium shrink-0">Gợi ý:</span>
          {PROMPT_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(chip)}
              className="px-2.5 py-1 rounded-full bg-white/70 dark:bg-slate-800/70 hover:bg-sky-50 dark:hover:bg-slate-700 hover:text-sky-700 dark:hover:text-sky-300 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700 shrink-0 transition-all text-left cursor-pointer"
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
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-400 to-teal-300 flex items-center justify-center text-white shrink-0 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                  isMe
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md shadow-sky-500/15'
                    : 'bg-white/80 dark:bg-slate-800/85 text-slate-700 dark:text-slate-200 border border-white/90 dark:border-slate-700 shadow-xs'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  <div className={`text-[10px] mt-1.5 ${isMe ? 'text-white/70 text-right' : 'text-slate-400'}`}>
                    {msg.timestamp}
                  </div>
                </div>

                {isMe && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 items-center text-xs text-slate-400">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-400 to-teal-300 flex items-center justify-center text-white shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white/70 dark:bg-slate-800/80 px-4 py-2.5 rounded-2xl border border-white/80 dark:border-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce [animation-delay:0.4s]" />
                <span className="text-slate-500 dark:text-slate-300 ml-1">Copilot đang suy nghĩ...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="pt-3 border-t border-slate-200/50 dark:border-slate-700/60 mt-2">
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
              className="flex-1 bg-white/80 dark:bg-slate-800/85 border border-slate-200/80 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder:text-slate-400 shadow-inner"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Gửi tin nhắn"
              className="p-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white hover:opacity-90 disabled:opacity-40 shadow-sm transition-all cursor-pointer"
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
