import React, { useEffect } from 'react';
import { X } from '../icons/UiIcons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'lg',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Solid Dimmed Backdrop (zero blur inside apps) */}
      <div
        className="fixed inset-0 bg-slate-950/55 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidthStyles} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-[28px] p-6 sm:p-7 z-10 my-8 animate-in fade-in zoom-in-95 duration-200 overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-900/10 dark:border-white/10">
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
              {title}
            </h3>
            {description && (
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 max-h-[75vh] overflow-y-auto pr-1">
          {children}
        </div>
      </div>
    </div>
  );
};
