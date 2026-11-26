import React, { useState, useEffect } from 'react';
import { BookOpen } from '../icons/UiIcons';

interface BookCoverThumbProps {
  coverUrl?: string;
  title: string;
  author?: string;
  category?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CATEGORY_GRADIENTS: Record<string, string> = {
  'Khoa học tự nhiên': 'from-emerald-600 to-teal-700',
  'Văn học & Ngữ văn': 'from-amber-600 to-orange-700',
  'Công nghệ & Tin học': 'from-sky-600 to-indigo-700',
  'Ngoại ngữ': 'from-violet-600 to-purple-700',
  'Kỹ năng sống': 'from-rose-600 to-pink-700',
  'Lịch sử & Xã hội': 'from-stone-600 to-amber-800',
  'Sách giáo khoa & Tham khảo': 'from-teal-600 to-emerald-700',
};

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-14 h-20 rounded-xl',
  md: 'w-18 h-26 rounded-xl',
  lg: 'w-32 h-44 sm:w-36 sm:h-52 rounded-2xl',
};

export const BookCoverThumb: React.FC<BookCoverThumbProps> = ({
  coverUrl,
  title,
  author,
  category,
  size = 'md',
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [coverUrl]);

  const validUrl =
    coverUrl &&
    (coverUrl.startsWith('https://') || coverUrl.startsWith('http://'))
      ? coverUrl
      : '';

  const gradient =
    (category && CATEGORY_GRADIENTS[category]) || 'from-emerald-600 to-teal-700';

  if (validUrl && !hasError) {
    return (
      <div
        className={`${SIZE_CLASSES[size]} relative overflow-hidden shrink-0 bg-slate-200 dark:bg-slate-800 border border-slate-900/10 dark:border-white/10 shadow-xs ${className}`}
      >
        <img
          src={validUrl}
          alt={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          onLoad={(e) => {
            const img = e.currentTarget;
            // Open Library returns a 1x1 transparent GIF if cover is absent without ?default=false
            if (img.naturalWidth > 0 && img.naturalWidth < 10) {
              setHasError(true);
            }
          }}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${SIZE_CLASSES[size]} bg-gradient-to-br ${gradient} text-white p-2 flex flex-col justify-between shrink-0 shadow-xs border border-white/15 ${className}`}
    >
      <BookOpen className={size === 'lg' ? 'w-6 h-6 opacity-90' : 'w-4 h-4 opacity-90'} />
      <div className="space-y-0.5 min-w-0">
        <span
          className={`block font-bold leading-tight ${
            size === 'lg' ? 'text-xs line-clamp-4' : 'text-[10px] line-clamp-3'
          }`}
        >
          {title}
        </span>
        {size === 'lg' && author && (
          <span className="block text-[10px] text-white/80 truncate">{author}</span>
        )}
      </div>
    </div>
  );
};
