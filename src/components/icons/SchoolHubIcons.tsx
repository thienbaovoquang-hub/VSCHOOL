import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

/* =====================================================================
   MAIN LOGO: SchoolHub Graduation Cap with Golden Tassel (from top-left)
   ===================================================================== */
export const SchoolHubLogoIcon: React.FC<IconProps> = ({ className = 'w-16 h-16', size }) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    <defs>
      <linearGradient id="sh-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="45%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#2563EB" />
      </linearGradient>
      <linearGradient id="sh-cap-top" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#E0EDFD" />
      </linearGradient>
      <linearGradient id="sh-tassel" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
      <filter id="sh-shadow" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#1D4ED8" floodOpacity="0.25" />
      </filter>
    </defs>
    {/* Squircle base */}
    <rect width="100" height="100" rx="26" fill="url(#sh-bg)" filter="url(#sh-shadow)" />
    <rect x="1" y="1" width="98" height="98" rx="25" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
    
    {/* Cap Underlayer / Base */}
    <path 
      d="M32 52C32 52 32 68 50 68C68 68 68 52 68 52V46H32V52Z" 
      fill="#CBDCF7" 
    />
    <path 
      d="M36 50C36 50 36 64 50 64C64 64 64 50 64 50" 
      stroke="#B0CBF1" 
      strokeWidth="2" 
    />
    
    {/* Diamond Cap Top (Isometric 3D) */}
    <polygon 
      points="50,25 80,39 50,53 20,39" 
      fill="url(#sh-cap-top)" 
      stroke="#D6E6FB"
      strokeWidth="1.5"
    />
    
    {/* Button on top */}
    <ellipse cx="50" cy="39" rx="3.5" ry="2.5" fill="#93C5FD" />
    
    {/* Tassel */}
    <path 
      d="M50 39 Q 68 40 73 50" 
      stroke="#F59E0B" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      fill="none" 
    />
    <circle cx="73.5" cy="53" r="2.5" fill="url(#sh-tassel)" />
    <rect x="72" y="55" width="3" height="8" rx="1" fill="url(#sh-tassel)" />
  </svg>
);

/* =====================================================================
   CLUSTER 1: QUẢN TRỊ HỆ THỐNG
   ===================================================================== */

// 1.1 Tổng quan (3 Rising Rounded Blue Bars)
export const IconOverview: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-c1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EBF4FE" />
        <stop offset="100%" stopColor="#D2E5FC" />
      </linearGradient>
      <linearGradient id="bar-blue" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-c1)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    <rect x="15" y="32" width="8" height="18" rx="4" fill="url(#bar-blue)" />
    <rect x="28" y="24" width="8" height="26" rx="4" fill="url(#bar-blue)" />
    <rect x="41" y="16" width="8" height="34" rx="4" fill="url(#bar-blue)" />
  </svg>
);

// 1.2 Quản lý người dùng (2 User Silhouettes in Royal Blue)
export const IconUserManagement: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-user" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EBF4FE" />
        <stop offset="100%" stopColor="#D2E5FC" />
      </linearGradient>
      <linearGradient id="usr-blue" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-user)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Left user */}
    <circle cx="27" cy="24" r="6" fill="url(#usr-blue)" />
    <path d="M16 46C16 38 21 34 27 34C33 34 38 38 38 46H16Z" fill="url(#usr-blue)" />
    {/* Right user */}
    <circle cx="43" cy="27" r="5" fill="#3B82F6" />
    <path d="M36 46C36 40 40 37 45 37C49 37 53 40 53 46H36Z" fill="#3B82F6" />
  </svg>
);

// 1.3 Phân quyền (Teal/Emerald Pill with White Shield Check)
export const IconPermissions: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-perm" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2DD4BF" />
        <stop offset="100%" stopColor="#0D9488" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-perm)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* White checkmark inside shield outline */}
    <path 
      d="M32 17L44 22V32C44 40 39 46 32 49C25 46 20 40 20 32V22L32 17Z" 
      fill="rgba(255,255,255,0.18)" 
      stroke="#FFFFFF" 
      strokeWidth="2.5" 
      strokeLinejoin="round" 
    />
    <path 
      d="M26 32L30.5 36.5L38 27.5" 
      stroke="#FFFFFF" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
  </svg>
);

// 1.4 Cài đặt hệ thống (Solid Royal Blue 8-tooth Gear)
export const IconSystemSettings: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-set" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EBF4FE" />
        <stop offset="100%" stopColor="#D2E5FC" />
      </linearGradient>
      <linearGradient id="gear-blue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-set)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    <path 
      d="M28.5 16H35.5L36.8 21.2C38 21.7 39.1 22.4 40.1 23.2L45.2 21.3L48.7 27.3L44.8 30.9C45 31.6 45 32.4 44.8 33.1L48.7 36.7L45.2 42.7L40.1 40.8C39.1 41.6 38 42.3 36.8 42.8L35.5 48H28.5L27.2 42.8C26 42.3 24.9 41.6 23.9 40.8L18.8 42.7L15.3 36.7L19.2 33.1C19 32.4 19 31.6 19.2 30.9L15.3 27.3L18.8 21.3L23.9 23.2C24.9 22.4 26 21.7 27.2 21.2L28.5 16Z" 
      fill="url(#gear-blue)" 
    />
    <circle cx="32" cy="32" r="5.5" fill="#EBF4FE" />
  </svg>
);

/* =====================================================================
   CLUSTER 2: QUẢN LÝ NHÀ TRƯỜNG
   ===================================================================== */

// 2.1 Quản lý học sinh (Cyan/Sky Squircle with White Cap)
export const IconStudents: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-stu" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#0284C7" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-stu)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Cap under */}
    <path d="M22 35C22 35 22 43 32 43C42 43 42 35 42 35" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    {/* Cap top diamond */}
    <polygon points="32,20 48,27 32,34 16,27" fill="#FFFFFF" />
    {/* Tassel */}
    <path d="M32 27 L 44 32 L 44 39" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" fill="none" />
    <circle cx="44" cy="40" r="1.5" fill="#FEF08A" />
  </svg>
);

// 2.2 Giáo viên & Nhân viên (3 Green Figures)
export const IconTeachersStaff: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-tea" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E6F9F3" />
        <stop offset="100%" stopColor="#C9F2E4" />
      </linearGradient>
      <linearGradient id="fig-green" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#059669" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-tea)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Center Lead Teacher */}
    <circle cx="32" cy="22" r="5" fill="url(#fig-green)" />
    <path d="M23 44C23 37 27 33 32 33C37 33 41 37 41 44H23Z" fill="url(#fig-green)" />
    {/* Left teacher */}
    <circle cx="21" cy="26" r="4" fill="#10B981" />
    <path d="M14 44C14 39 17 36 21 36C23 36 25 37 26 39" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    {/* Right teacher */}
    <circle cx="43" cy="26" r="4" fill="#10B981" />
    <path d="M38 39C39 37 41 36 43 36C47 36 50 39 50 44" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" fill="none" />
  </svg>
);

// 2.3 Quản lý lớp học (Teacher at presentation desk / blackboard in Royal Blue)
export const IconClassrooms: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-cls" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EBF4FE" />
        <stop offset="100%" stopColor="#D2E5FC" />
      </linearGradient>
      <linearGradient id="cls-blue" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-cls)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Screen / Blackboard */}
    <rect x="22" y="16" width="26" height="19" rx="3" fill="#3B82F6" />
    <path d="M26 23H44M26 28H38" stroke="#EBF4FE" strokeWidth="1.8" strokeLinecap="round" />
    {/* Desk stand */}
    <rect x="33" y="35" width="4" height="8" rx="1" fill="#1D4ED8" />
    <rect x="27" y="43" width="16" height="3" rx="1.5" fill="#1D4ED8" />
    {/* Teacher silhouette on left */}
    <circle cx="21" cy="27" r="4.5" fill="url(#cls-blue)" />
    <path d="M14 44C14 38 17 35 22 35C24.5 35 26.5 36 27.5 38" stroke="url(#cls-blue)" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

// 2.4 Năm học & Học kỳ (Turquoise/Cyan Calendar with 6 dots)
export const IconAcademicYear: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-cal-c" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E0F7FA" />
        <stop offset="100%" stopColor="#B2EBF2" />
      </linearGradient>
      <linearGradient id="cal-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00ACC1" />
        <stop offset="100%" stopColor="#00838F" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-cal-c)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Calendar body */}
    <rect x="16" y="18" width="32" height="30" rx="6" fill="url(#cal-cyan)" />
    {/* Top rings */}
    <rect x="23" y="14" width="4" height="6" rx="2" fill="#80DEEA" />
    <rect x="37" y="14" width="4" height="6" rx="2" fill="#80DEEA" />
    {/* 6 Dots */}
    <circle cx="23" cy="29" r="2" fill="#FFFFFF" />
    <circle cx="32" cy="29" r="2" fill="#FFFFFF" />
    <circle cx="41" cy="29" r="2" fill="#FFFFFF" />
    <circle cx="23" cy="37" r="2" fill="#FFFFFF" />
    <circle cx="32" cy="37" r="2" fill="#FFFFFF" />
    <circle cx="41" cy="37" r="2" fill="#FFFFFF" />
  </svg>
);

/* =====================================================================
   CLUSTER 3: HỌC TẬP VÀ GIẢNG DẠY
   ===================================================================== */

// 3.1 Thời khóa biểu (Blue-violet calendar with 6 grid points)
export const IconTimetable: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-tt" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EDE9FE" />
        <stop offset="100%" stopColor="#DDD6FE" />
      </linearGradient>
      <linearGradient id="cal-purple" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4F46E5" />
        <stop offset="100%" stopColor="#6366F1" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-tt)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    <rect x="16" y="18" width="32" height="30" rx="6" fill="url(#cal-purple)" />
    <rect x="23" y="14" width="4" height="6" rx="2" fill="#A5B4FC" />
    <rect x="37" y="14" width="4" height="6" rx="2" fill="#A5B4FC" />
    <circle cx="23" cy="29" r="2" fill="#FFFFFF" />
    <circle cx="32" cy="29" r="2" fill="#FFFFFF" />
    <circle cx="41" cy="29" r="2" fill="#FFFFFF" />
    <circle cx="23" cy="37" r="2" fill="#FFFFFF" />
    <circle cx="32" cy="37" r="2" fill="#FFFFFF" />
    <circle cx="41" cy="37" r="2" fill="#FFFFFF" />
  </svg>
);

// 3.2 Điểm danh (Emerald squircle with white checkmark inside)
export const IconAttendance: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-att" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#34D399" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-att)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    <rect x="18" y="18" width="28" height="28" rx="8" fill="#047857" opacity="0.4" />
    <path 
      d="M24 33L29.5 38.5L41 26" 
      stroke="#FFFFFF" 
      strokeWidth="4" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
  </svg>
);

// 3.3 Điểm số & Kết quả học tập (Orange-Peach squircle with bold white "A+")
export const IconGradesA: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-grd" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FB923C" />
        <stop offset="100%" stopColor="#EA580C" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-grd)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Inner soft pill */}
    <rect x="16" y="16" width="32" height="32" rx="10" fill="#C2410C" opacity="0.35" />
    {/* Letter A */}
    <path 
      d="M23 40 L 29 24 L 35 40 M25 35 H 33" 
      stroke="#FFFFFF" 
      strokeWidth="3.2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
    {/* Plus sign */}
    <path 
      d="M40 30 V 36 M37 33 H 43" 
      stroke="#FFFFFF" 
      strokeWidth="3" 
      strokeLinecap="round" 
    />
  </svg>
);

// 3.4 Bài tập & Học liệu (Deep Blue Open Book)
export const IconCurriculum: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-cur" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EBF4FE" />
        <stop offset="100%" stopColor="#D2E5FC" />
      </linearGradient>
      <linearGradient id="bk-blue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E40AF" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-cur)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Left page */}
    <path d="M16 23C21 21 28 22 31 24V44C28 42 21 41 16 43V23Z" fill="url(#bk-blue)" />
    {/* Right page */}
    <path d="M48 23C43 21 36 22 33 24V44C36 42 43 41 48 43V23Z" fill="url(#bk-blue)" />
    {/* Center spine */}
    <line x1="32" y1="24" x2="32" y2="44" stroke="#93C5FD" strokeWidth="1.5" />
  </svg>
);

/* =====================================================================
   CLUSTER 4: THƯ VIỆN THÔNG MINH
   ===================================================================== */

// 4.1 Thư viện thông minh (Bookshelf with 3 Books: Orange, Blue, Yellow)
export const IconSmartLibrary: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-lib" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF3C7" />
        <stop offset="100%" stopColor="#FDE68A" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-lib)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Book 1 (Orange, standing) */}
    <rect x="18" y="20" width="8" height="26" rx="2" fill="#F97316" />
    <line x1="20" y1="24" x2="24" y2="24" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
    {/* Book 2 (Blue, standing) */}
    <rect x="28" y="20" width="8" height="26" rx="2" fill="#2563EB" />
    <line x1="30" y1="24" x2="34" y2="24" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
    {/* Book 3 (Gold/Yellow, leaning) */}
    <g transform="rotate(18 38 46)">
      <rect x="36" y="20" width="7.5" height="26" rx="2" fill="#EAB308" />
      <line x1="38" y1="24" x2="41" y2="24" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
    </g>
    {/* Shelf line */}
    <line x1="14" y1="48" x2="50" y2="48" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

// 4.2 RFID & Barcode (Scanner Gun with Beam in Royal Blue)
export const IconRfidScanner: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-rfid" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF3C7" />
        <stop offset="100%" stopColor="#FDE68A" />
      </linearGradient>
      <linearGradient id="gun-blue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E40AF" />
        <stop offset="100%" stopColor="#2563EB" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-rfid)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Scanner head */}
    <path d="M22 21C22 19 24 17 27 17H43C45 17 47 19 47 21V28C47 30 45 32 43 32H35L33 34V46C33 48 31 49 29 49H27C25 49 23 48 23 46V33H26C28 33 29 32 29 30V24H22V21Z" fill="url(#gun-blue)" />
    {/* Yellow laser window */}
    <rect x="45" y="20" width="3" height="9" rx="1.5" fill="#EF4444" />
    {/* Laser scan lines */}
    <line x1="49" y1="21" x2="53" y2="21" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="49" y1="24.5" x2="55" y2="24.5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="49" y1="28" x2="53" y2="28" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// 4.3 Mượn & Trả sách (Purple Open Book with Golden Circle '+')
export const IconBorrowReturn: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-brw" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF3C7" />
        <stop offset="100%" stopColor="#FDE68A" />
      </linearGradient>
      <linearGradient id="bk-purp" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6366F1" />
        <stop offset="100%" stopColor="#4338CA" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-brw)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Book */}
    <path d="M18 24C22 22 28 23 31 25V43C28 41 22 40 18 42V24Z" fill="url(#bk-purp)" />
    <path d="M46 24C42 22 36 23 33 25V43C36 41 42 40 46 42V24Z" fill="url(#bk-purp)" />
    {/* Golden badge '+' on bottom right */}
    <circle cx="44" cy="40" r="7" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1.5" />
    <path d="M44 36V44M40 40H48" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 4.4 Lịch sử thư viện (Reddish-Orange Round Clock at 2:00)
export const IconLibraryHistory: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-hst" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEE2E2" />
        <stop offset="100%" stopColor="#FECACA" />
      </linearGradient>
      <linearGradient id="clk-red" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#B91C1C" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-hst)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Clock ring */}
    <circle cx="32" cy="32" r="16" fill="url(#clk-red)" />
    <circle cx="32" cy="32" r="11" fill="#FFFFFF" />
    {/* Hands at 2:00 */}
    <path d="M32 32 V 25 M32 32 L 38 28" stroke="#B91C1C" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="32" cy="32" r="1.5" fill="#B91C1C" />
  </svg>
);

/* =====================================================================
   CLUSTER 5: TƯƠNG TÁC VÀ DỊCH VỤ HỌC SINH
   ===================================================================== */

// 5.1 Khảo sát (Blue Clipboard with 3 Checklist Lines)
export const IconSurveys: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-svy" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E0F2FE" />
        <stop offset="100%" stopColor="#BAE6FD" />
      </linearGradient>
      <linearGradient id="cb-blue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0284C7" />
        <stop offset="100%" stopColor="#0369A1" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-svy)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Clipboard base */}
    <rect x="18" y="18" width="28" height="32" rx="4" fill="url(#cb-blue)" />
    {/* Clip top */}
    <rect x="25" y="15" width="14" height="5" rx="2" fill="#38BDF8" />
    {/* Lines */}
    <circle cx="24" cy="27" r="1.5" fill="#FFFFFF" />
    <line x1="28" y1="27" x2="40" y2="27" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    <circle cx="24" cy="34" r="1.5" fill="#FFFFFF" />
    <line x1="28" y1="34" x2="40" y2="34" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    <circle cx="24" cy="41" r="1.5" fill="#FFFFFF" />
    <line x1="28" y1="41" x2="36" y2="41" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 5.2 Phản ánh & Báo cáo (Blue Speech Bubble with 3 Dots)
export const IconFeedback: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-fb" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E0F2FE" />
        <stop offset="100%" stopColor="#BAE6FD" />
      </linearGradient>
      <linearGradient id="bbl-blue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0284C7" />
        <stop offset="100%" stopColor="#0369A1" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-fb)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    <path 
      d="M17 21C17 18 20 16 24 16H40C44 16 47 18 47 21V33C47 36 44 38 40 38H33L26 44V38H24C20 38 17 36 17 33V21Z" 
      fill="url(#bbl-blue)" 
    />
    <circle cx="26" cy="27" r="2.2" fill="#FFFFFF" />
    <circle cx="32" cy="27" r="2.2" fill="#FFFFFF" />
    <circle cx="38" cy="27" r="2.2" fill="#FFFFFF" />
  </svg>
);

// 5.3 Tư vấn học đường (2 Blue Heads Facing)
export const IconCounseling: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-cns" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E0F2FE" />
        <stop offset="100%" stopColor="#BAE6FD" />
      </linearGradient>
      <linearGradient id="cns-blue" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#0284C7" />
        <stop offset="100%" stopColor="#0369A1" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-cns)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Left person */}
    <circle cx="25" cy="25" r="5" fill="url(#cns-blue)" />
    <path d="M15 44C15 37 20 34 26 34C28 34 30 35 32 36C30 38 29 41 29 44H15Z" fill="url(#cns-blue)" />
    {/* Right person */}
    <circle cx="39" cy="25" r="5" fill="#38BDF8" />
    <path d="M35 44C35 41 34 38 32 36C34 35 36 34 38 34C44 34 49 37 49 44H35Z" fill="#38BDF8" />
  </svg>
);

// 5.4 Xin nghỉ & Đơn từ (Document with Pen in Blue)
export const IconLeaveRequests: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-lve" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E0F2FE" />
        <stop offset="100%" stopColor="#BAE6FD" />
      </linearGradient>
      <linearGradient id="doc-blue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0284C7" />
        <stop offset="100%" stopColor="#0369A1" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-lve)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Document */}
    <rect x="18" y="16" width="24" height="32" rx="3" fill="url(#doc-blue)" />
    <line x1="23" y1="23" x2="35" y2="23" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    <line x1="23" y1="29" x2="35" y2="29" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    <line x1="23" y1="35" x2="31" y2="35" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    {/* Pen on bottom-right */}
    <g transform="rotate(-45 42 38)">
      <rect x="39" y="26" width="5" height="18" rx="2" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="1" />
      <polygon points="39,44 44,44 41.5,49" fill="#0369A1" />
    </g>
  </svg>
);

/* =====================================================================
   CLUSTER 6: THÔNG TIN VÀ TRUYỀN THÔNG
   ===================================================================== */

// 6.1 Thông báo (Green Bell on Mint Background)
export const IconAnnouncements: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-anc" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#DCFCE7" />
        <stop offset="100%" stopColor="#BBF7D0" />
      </linearGradient>
      <linearGradient id="bel-green" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-anc)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Bell body */}
    <path 
      d="M32 16C26.5 16 22 20.5 22 26V35L18 41H46L42 35V26C42 20.5 37.5 16 32 16Z" 
      fill="url(#bel-green)" 
    />
    {/* Bell clapper */}
    <circle cx="32" cy="45" r="3.5" fill="#047857" />
  </svg>
);

// 6.2 Sự kiện & Hoạt động (Cyan Calendar with Star in Center)
export const IconEvents: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-evt" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E0F7FA" />
        <stop offset="100%" stopColor="#B2EBF2" />
      </linearGradient>
      <linearGradient id="cal-evt" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00ACC1" />
        <stop offset="100%" stopColor="#00838F" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-evt)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    <rect x="16" y="18" width="32" height="30" rx="6" fill="url(#cal-evt)" />
    <rect x="23" y="14" width="4" height="6" rx="2" fill="#80DEEA" />
    <rect x="37" y="14" width="4" height="6" rx="2" fill="#80DEEA" />
    {/* Star */}
    <polygon 
      points="32,27 34,31.5 39,32 35,35.5 36.5,40.5 32,38 27.5,40.5 29,35.5 25,32 30,31.5" 
      fill="#FEF08A" 
    />
  </svg>
);

// 6.3 Trung tâm thông báo (Blue Closed Mail Envelope)
export const IconNotificationCenter: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-ntc" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EBF4FE" />
        <stop offset="100%" stopColor="#D2E5FC" />
      </linearGradient>
      <linearGradient id="env-blue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-ntc)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Envelope base */}
    <rect x="16" y="21" width="32" height="22" rx="4" fill="url(#env-blue)" />
    {/* Envelope flap */}
    <path d="M17 22L32 33L47 22" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* =====================================================================
   CLUSTER 7: CƠ SỞ VẬT CHẤT
   ===================================================================== */

// 7.1 Quản lý cơ sở vật chất (Two Blue Building Blocks / Campus)
export const IconFacilities: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-fac" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EBF4FE" />
        <stop offset="100%" stopColor="#D2E5FC" />
      </linearGradient>
      <linearGradient id="bld-blue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-fac)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Left Building (Tall) */}
    <rect x="18" y="19" width="16" height="27" rx="3" fill="url(#bld-blue)" />
    <rect x="22" y="24" width="3" height="3" rx="0.5" fill="#FFFFFF" />
    <rect x="27" y="24" width="3" height="3" rx="0.5" fill="#FFFFFF" />
    <rect x="22" y="30" width="3" height="3" rx="0.5" fill="#FFFFFF" />
    <rect x="27" y="30" width="3" height="3" rx="0.5" fill="#FFFFFF" />
    <rect x="23.5" y="38" width="5" height="8" rx="1" fill="#93C5FD" />
    {/* Right Building (Shorter) */}
    <rect x="34" y="27" width="14" height="19" rx="3" fill="#3B82F6" />
    <rect x="37" y="31" width="3" height="3" rx="0.5" fill="#FFFFFF" />
    <rect x="42" y="31" width="3" height="3" rx="0.5" fill="#FFFFFF" />
    <rect x="37" y="37" width="3" height="3" rx="0.5" fill="#FFFFFF" />
    <rect x="42" y="37" width="3" height="3" rx="0.5" fill="#FFFFFF" />
  </svg>
);

// 7.2 Bảo trì & Sửa chữa (Angled Blue Wrench)
export const IconMaintenance: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-mnt" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EBF4FE" />
        <stop offset="100%" stopColor="#D2E5FC" />
      </linearGradient>
      <linearGradient id="wr-blue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-mnt)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    <g transform="rotate(-45 32 32)">
      {/* Wrench handle */}
      <rect x="29" y="24" width="6" height="24" rx="3" fill="url(#wr-blue)" />
      {/* Wrench head */}
      <path 
        d="M26 24 C23 20 25 15 32 15 C39 15 41 20 38 24 C36 22 34 22 32 24 C30 22 28 22 26 24 Z" 
        fill="url(#wr-blue)" 
      />
    </g>
  </svg>
);

/* =====================================================================
   CLUSTER 8: PHÂN TÍCH VÀ AI
   ===================================================================== */

// 8.1 Báo cáo & Thống kê (Blue Bars with Ascending Purple Arrow)
export const IconReportsAnalytics: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-rpt" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EBF4FE" />
        <stop offset="100%" stopColor="#D2E5FC" />
      </linearGradient>
      <linearGradient id="bar-rpt" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-rpt)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Bars */}
    <rect x="16" y="34" width="7" height="15" rx="3" fill="url(#bar-rpt)" />
    <rect x="26" y="26" width="7" height="23" rx="3" fill="url(#bar-rpt)" />
    <rect x="36" y="18" width="7" height="31" rx="3" fill="url(#bar-rpt)" />
    {/* Rising arrow */}
    <path 
      d="M17 31 L 28 22 L 37 25 L 47 15 M47 15 H 41 M47 15 V 21" 
      stroke="#7C3AED" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
  </svg>
);

// 8.2 Trợ lý AI (Friendly Robot Face Avatar with Antennas)
export const IconAiAssistant: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-ai" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EBF4FE" />
        <stop offset="100%" stopColor="#D2E5FC" />
      </linearGradient>
      <linearGradient id="bot-blue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-ai)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Antenna */}
    <circle cx="32" cy="18" r="2.5" fill="#3B82F6" />
    <line x1="32" y1="20" x2="32" y2="24" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
    {/* Head */}
    <rect x="18" y="24" width="28" height="23" rx="7" fill="url(#bot-blue)" />
    {/* Screen / Visor */}
    <rect x="22" y="28" width="20" height="9" rx="3.5" fill="#EBF4FE" />
    {/* Glowing Eyes */}
    <circle cx="27" cy="32.5" r="2" fill="#2563EB" />
    <circle cx="37" cy="32.5" r="2" fill="#2563EB" />
    {/* Cheerful Smile */}
    <path d="M29 41 Q 32 43 35 41" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    {/* Ear knobs */}
    <rect x="15" y="31" width="3" height="7" rx="1" fill="#3B82F6" />
    <rect x="46" y="31" width="3" height="7" rx="1" fill="#3B82F6" />
  </svg>
);

// 8.3 Import & Export (Data Exchange Looping Arrows)
export const IconDataExchange: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="bg-exc" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E0F2FE" />
        <stop offset="100%" stopColor="#BAE6FD" />
      </linearGradient>
      <linearGradient id="ar-blue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0284C7" />
        <stop offset="100%" stopColor="#0369A1" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#bg-exc)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
    {/* Arrow pointing right */}
    <path 
      d="M20 27H40M40 27L34 21M40 27L34 33" 
      stroke="url(#ar-blue)" 
      strokeWidth="3.2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
    {/* Arrow pointing left */}
    <path 
      d="M44 39H24M24 39L30 33M24 39L30 45" 
      stroke="url(#ar-blue)" 
      strokeWidth="3.2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
  </svg>
);

/* =====================================================================
   MAPPING DICTIONARY: MODULE ID -> NEW ICON COMPONENT
   ===================================================================== */
export const SCHOOLHUB_APP_ICONS: Record<string, React.FC<IconProps>> = {
  dashboard: IconOverview,
  students: IconStudents,
  staff: IconTeachersStaff,
  classes: IconClassrooms,
  timetable: IconTimetable,
  academic: IconAttendance,
  library: IconSmartLibrary,
  surveys: IconSurveys,
  feedback: IconFeedback,
  counseling: IconCounseling,
  facilities: IconFacilities,
  announcements: IconAnnouncements,
  reports: IconReportsAnalytics,
  datacenter: IconSystemSettings,
  permissions: IconPermissions,
};

/* =====================================================================
   8 SUPER APPS — WINDOWS 11 LIQUID GLASS SQUIRCLE ICONS
   ===================================================================== */

export const IconSuperAdmin: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="sa-admin-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="50%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#4338CA" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#sa-admin-bg)" />
    <rect x="3" y="3" width="58" height="58" rx="17" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
    <path d="M32 14L46 20V31C46 40.5 39.8 47.5 32 50C24.2 47.5 18 40.5 18 31V20L32 14Z" fill="rgba(255,255,255,0.22)" stroke="#FFFFFF" strokeWidth="2.4" strokeLinejoin="round" />
    <line x1="25" y1="28" x2="39" y2="28" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="29" cy="28" r="2.5" fill="#93C5FD" stroke="#FFFFFF" strokeWidth="1.5" />
    <line x1="25" y1="36" x2="39" y2="36" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="35" cy="36" r="2.5" fill="#93C5FD" stroke="#FFFFFF" strokeWidth="1.5" />
  </svg>
);

export const IconSuperSchool: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="sa-school-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="55%" stopColor="#0EA5E9" />
        <stop offset="100%" stopColor="#0284C7" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#sa-school-bg)" />
    <rect x="3" y="3" width="58" height="58" rx="17" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
    <polygon points="32,16 50,25 32,34 14,25" fill="#FFFFFF" />
    <path d="M21 31V40C21 43.5 25.9 47 32 47C38.1 47 43 43.5 43 40V31" fill="rgba(255,255,255,0.28)" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M46 28V40" stroke="#FDE047" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="46" cy="42" r="2.2" fill="#FDE047" />
  </svg>
);

export const IconSuperLearning: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="sa-learn-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#A78BFA" />
        <stop offset="50%" stopColor="#6366F1" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#sa-learn-bg)" />
    <rect x="3" y="3" width="58" height="58" rx="17" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
    <path d="M15 21C20.5 19 27.5 20 31 23V45C27.5 42 20.5 41 15 43V21Z" fill="rgba(255,255,255,0.92)" />
    <path d="M49 21C43.5 19 36.5 20 33 23V45C36.5 42 43.5 41 49 43V21Z" fill="rgba(255,255,255,0.78)" />
    <path d="M20 27H26M20 33H26" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" />
    <circle cx="41" cy="30" r="3" fill="#6366F1" />
  </svg>
);

export const IconSuperLibrary: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="sa-lib-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#34D399" />
        <stop offset="55%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#sa-lib-bg)" />
    <rect x="3" y="3" width="58" height="58" rx="17" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
    <rect x="16" y="19" width="9" height="27" rx="2.5" fill="#FFFFFF" />
    <rect x="27" y="16" width="9" height="30" rx="2.5" fill="rgba(255,255,255,0.84)" />
    <rect x="38" y="21" width="9" height="25" rx="2.5" fill="rgba(255,255,255,0.68)" />
    <line x1="14" y1="48.5" x2="50" y2="48.5" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="42.5" cy="27" r="2" fill="#047857" />
  </svg>
);

export const IconSuperServices: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="sa-svc-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F472B6" />
        <stop offset="50%" stopColor="#EC4899" />
        <stop offset="100%" stopColor="#FB7185" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#sa-svc-bg)" />
    <rect x="3" y="3" width="58" height="58" rx="17" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
    <path d="M16 22C16 18.7 18.7 16 22 16H42C45.3 16 48 18.7 48 22V36C48 39.3 45.3 42 42 42H29L21 48V42C18.2 41.5 16 39 16 36V22Z" fill="rgba(255,255,255,0.25)" stroke="#FFFFFF" strokeWidth="2.3" strokeLinejoin="round" />
    <path d="M32 35.5C32 35.5 24.5 30.8 24.5 26C24.5 23.8 26.2 22 28.4 22C29.8 22 31.1 22.8 32 23.9C32.9 22.8 34.2 22 35.6 22C37.8 22 39.5 23.8 39.5 26C39.5 30.8 32 35.5 32 35.5Z" fill="#FFFFFF" />
  </svg>
);

export const IconSuperCommunication: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="sa-comm-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDBA74" />
        <stop offset="50%" stopColor="#FB923C" />
        <stop offset="100%" stopColor="#EA580C" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#sa-comm-bg)" />
    <rect x="3" y="3" width="58" height="58" rx="17" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
    <path d="M32 16C25.5 16 20.5 21 20.5 27.5V36L16.5 41.5H47.5L43.5 36V27.5C43.5 21 38.5 16 32 16Z" fill="#FFFFFF" />
    <path d="M27.5 44.5C28.3 46.8 30 48.2 32 48.2C34 48.2 35.7 46.8 36.5 44.5" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" />
    <circle cx="43" cy="20" r="4.5" fill="#FEF08A" stroke="#EA580C" strokeWidth="1.5" />
  </svg>
);

export const IconSuperFacilities: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="sa-fac-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2DD4BF" />
        <stop offset="55%" stopColor="#14B8A6" />
        <stop offset="100%" stopColor="#0F766E" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#sa-fac-bg)" />
    <rect x="3" y="3" width="58" height="58" rx="17" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
    <rect x="15" y="18" width="18" height="30" rx="3.5" fill="#FFFFFF" />
    <rect x="19" y="23" width="4" height="4" rx="1" fill="#0F766E" />
    <rect x="25" y="23" width="4" height="4" rx="1" fill="#0F766E" />
    <rect x="19" y="30" width="4" height="4" rx="1" fill="#0F766E" />
    <rect x="25" y="30" width="4" height="4" rx="1" fill="#0F766E" />
    <rect x="22" y="39" width="4" height="9" rx="1" fill="#0D9488" />
    <rect x="35" y="27" width="14" height="21" rx="3" fill="rgba(255,255,255,0.78)" />
    <rect x="39" y="32" width="6" height="3" rx="1" fill="#0F766E" />
    <rect x="39" y="38" width="6" height="3" rx="1" fill="#0F766E" />
  </svg>
);

export const IconSuperAnalytics: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="sa-ai-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C084FC" />
        <stop offset="50%" stopColor="#8B5CF6" />
        <stop offset="100%" stopColor="#4F46E5" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#sa-ai-bg)" />
    <rect x="3" y="3" width="58" height="58" rx="17" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
    <rect x="16" y="34" width="7" height="14" rx="3" fill="rgba(255,255,255,0.85)" />
    <rect x="26.5" y="26" width="7" height="22" rx="3" fill="rgba(255,255,255,0.95)" />
    <rect x="37" y="19" width="7" height="29" rx="3" fill="#FFFFFF" />
    <path d="M46 13L47.8 17.2L52 19L47.8 20.8L46 25L44.2 20.8L40 19L44.2 17.2L46 13Z" fill="#FEF08A" />
  </svg>
);

export const IconSuperSubjects: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={size ? { width: size, height: size } : undefined}>
    <defs>
      <linearGradient id="sa-subj-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="50%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#0D9488" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#sa-subj-bg)" />
    <rect x="3" y="3" width="58" height="58" rx="17" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
    <rect x="14" y="16" width="22" height="22" rx="6" fill="rgba(255,255,255,0.94)" />
    <path d="M25 22L20.5 32.5M25 22L29.5 32.5M22.2 29.2H27.8" stroke="#1D4ED8" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="28" y="26" width="22" height="22" rx="6" fill="rgba(255,255,255,0.28)" stroke="#FFFFFF" strokeWidth="2" />
    <path d="M35 34H43M39 34V42M35 42H43" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SUPER_APP_ICONS: Record<string, React.FC<IconProps>> = {
  admin: IconSuperAdmin,
  school: IconSuperSchool,
  learning: IconSuperLearning,
  library: IconSuperLibrary,
  services: IconSuperServices,
  communication: IconSuperCommunication,
  facilities: IconSuperFacilities,
  analytics: IconSuperAnalytics,
  subjects: IconSuperSubjects,
};
