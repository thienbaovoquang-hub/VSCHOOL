import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface UserAvatarProps {
  name: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const AVATAR_GRADIENTS = [
  'from-sky-500 to-indigo-600',
  'from-teal-500 to-emerald-600',
  'from-indigo-500 to-purple-600',
  'from-pink-500 to-rose-600',
  'from-amber-500 to-orange-600'
];

function pickGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function getInitials(name: string): string {
  const parts = (name || 'U').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[parts.length - 1].charAt(0) || 'U').toUpperCase();
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  size = 'md',
  className = ''
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const sizeClass = {
    sm: 'w-7 h-7 text-[11px] rounded-lg',
    md: 'w-8 h-8 text-xs rounded-xl',
    lg: 'w-9 h-9 text-xs rounded-xl'
  }[size];

  const isExternalSafe =
    avatarUrl &&
    !avatarUrl.includes('images.unsplash.com') &&
    !imgFailed;

  if (isExternalSafe) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${sizeClass} object-cover ring-1 ring-sky-300/60 shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`${sizeClass} bg-gradient-to-tr ${pickGradient(name)} text-white font-bold flex items-center justify-center shadow-xs shrink-0 ${className}`}
    >
      {getInitials(name)}
    </div>
  );
};

interface BookCoverProps {
  title: string;
  category?: string;
  coverUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const BOOK_PALETTES: Record<string, string> = {
  'Toán học': 'from-sky-500 via-blue-500 to-indigo-600',
  'Khoa học Tự nhiên': 'from-teal-500 via-emerald-500 to-cyan-600',
  'Công nghệ & Tin học': 'from-indigo-500 via-purple-500 to-sky-600',
  'Văn học - Nghệ thuật': 'from-rose-500 via-pink-500 to-purple-500',
  'Kỹ năng sống & Hướng nghiệp': 'from-amber-500 via-orange-500 to-rose-500'
};

export const BookCover: React.FC<BookCoverProps> = ({
  title,
  category = '',
  coverUrl,
  size = 'lg',
  className = ''
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const sizeClass = {
    sm: 'w-8 h-10 rounded-md',
    md: 'w-12 h-16 rounded-lg',
    lg: 'w-24 h-32 rounded-xl'
  }[size];

  const isCustomCover =
    coverUrl &&
    !coverUrl.includes('images.unsplash.com') &&
    !imgFailed;

  if (isCustomCover) {
    return (
      <img
        src={coverUrl}
        alt={title}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${sizeClass} object-cover shadow-xs shrink-0 ${className}`}
      />
    );
  }

  const gradient = BOOK_PALETTES[category] || 'from-sky-500 via-teal-500 to-indigo-600';

  return (
    <div
      className={`${sizeClass} bg-gradient-to-br ${gradient} text-white shadow-sm shrink-0 relative overflow-hidden flex flex-col justify-between p-2 border border-white/40 ${className}`}
      aria-label={title}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.35),transparent_60%)] pointer-events-none" />
      <div className="relative z-10 flex items-center justify-between">
        <BookOpen className={size === 'sm' ? 'w-3 h-3 opacity-90' : size === 'md' ? 'w-3.5 h-3.5 opacity-90' : 'w-4 h-4 opacity-90'} />
        {size === 'lg' && (
          <span className="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded">
            RFID
          </span>
        )}
      </div>
      {size === 'lg' && (
        <p className="relative z-10 text-[10px] font-bold leading-tight line-clamp-3 drop-shadow-xs">
          {title}
        </p>
      )}
    </div>
  );
};
