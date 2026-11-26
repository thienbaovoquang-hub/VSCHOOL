import React, { useId } from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

interface GlossySquircleProps extends IconProps {
  topColor: string;
  midColor: string;
  bottomColor: string;
  shadowColor: string;
  children: React.ReactNode;
}

const GlossySquircle: React.FC<GlossySquircleProps> = ({
  className = 'w-14 h-14',
  size,
  topColor,
  midColor,
  bottomColor,
  shadowColor,
  children,
}) => {
  const rawId = useId().replace(/:/g, '');
  const gradId = `sq-grad-${rawId}`;
  const glossId = `sq-gloss-${rawId}`;
  const shadowId = `sq-shadow-${rawId}`;
  const glyphShadowId = `sq-glyph-${rawId}`;

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="14%" y1="6%" x2="88%" y2="96%">
          <stop offset="0%" stopColor={topColor} />
          <stop offset="52%" stopColor={midColor} />
          <stop offset="100%" stopColor={bottomColor} />
        </linearGradient>

        <linearGradient id={glossId} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.34" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        <filter id={shadowId} x="-12%" y="-10%" width="124%" height="128%">
          <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor={shadowColor} floodOpacity="0.28" />
        </filter>

        <filter id={glyphShadowId} x="-18%" y="-18%" width="136%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={shadowColor} floodOpacity="0.32" />
        </filter>
      </defs>

      {/* Main Gradient Squircle */}
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="24"
        fill={`url(#${gradId})`}
        filter={`url(#${shadowId})`}
      />

      {/* Soft Upper Glossy Highlight */}
      <path
        d="M28 5H72C84.7 5 95 15.3 95 28V43C77 49.5 23 49.5 5 43V28C5 15.3 15.3 5 28 5Z"
        fill={`url(#${glossId})`}
      />

      {/* Crisp Inner Rim Highlight */}
      <rect
        x="5"
        y="5"
        width="90"
        height="90"
        rx="23"
        stroke="rgba(255,255,255,0.46)"
        strokeWidth="1.5"
      />

      {/* Crisp Centered White Vector Glyph */}
      <g filter={`url(#${glyphShadowId})`}>{children}</g>
    </svg>
  );
};

/* =====================================================================
   MAIN LOGO: Glossy Blue Graduation Cap Squircle
   ===================================================================== */
export const SchoolHubLogoIcon: React.FC<IconProps> = ({ className = 'w-16 h-16', size }) => (
  <GlossySquircle
    className={className}
    size={size}
    topColor="#7FB8FF"
    midColor="#4578F7"
    bottomColor="#2554EE"
    shadowColor="#1D4ED8"
  >
    <path
      d="M32 54C32 54 32 68 50 68C68 68 68 54 68 54V48H32V54Z"
      fill="rgba(255,255,255,0.88)"
    />
    <polygon points="50,24 80,38 50,52 20,38" fill="#FFFFFF" />
    <path d="M50 38Q68 39 73 50" stroke="#FDE047" strokeWidth="3" strokeLinecap="round" />
    <circle cx="73.5" cy="53" r="2.8" fill="#FDE047" />
    <rect x="72" y="55" width="3" height="8" rx="1.5" fill="#FBBF24" />
  </GlossySquircle>
);

/* =====================================================================
   9 SUPER APPS — GLOSSY GRADIENT SQUIRCLE ICONS (MATCHING ATTACHED PNGs)
   ===================================================================== */

// 1. Quản trị hệ thống (Blue Squircle + White 8-tooth Gear)
export const IconSuperAdmin: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => {
  const maskId = `admin-mask-${useId().replace(/:/g, '')}`;
  return (
    <GlossySquircle
      className={className}
      size={size}
      topColor="#81B9FF"
      midColor="#4B7CF7"
      bottomColor="#2B58F3"
      shadowColor="#2551E8"
    >
      <defs>
        <mask id={maskId}>
          <rect width="100" height="100" fill="white" />
          <circle cx="50" cy="50" r="9.6" fill="black" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`} fill="#FFFFFF">
        <circle cx="50" cy="50" r="21.5" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <rect
            key={deg}
            x="44.5"
            y="22.5"
            width="11"
            height="11"
            rx="3"
            transform={`rotate(${deg} 50 50)`}
          />
        ))}
      </g>
    </GlossySquircle>
  );
};

// 2. Quản lý nhà trường (Mint-Teal Squircle + White Schoolhouse with Flag & Arch Door)
export const IconSuperSchool: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => {
  const maskId = `school-mask-${useId().replace(/:/g, '')}`;
  return (
    <GlossySquircle
      className={className}
      size={size}
      topColor="#7BEAC2"
      midColor="#2BC695"
      bottomColor="#0FA177"
      shadowColor="#0D8F6A"
    >
      <defs>
        <mask id={maskId}>
          <rect width="100" height="100" fill="white" />
          {/* Gable circular window */}
          <circle cx="50" cy="44.2" r="3" fill="black" />
          {/* Left 2 windows */}
          <rect x="33.5" y="51.2" width="6.2" height="5.8" rx="1.4" fill="black" />
          <rect x="33.5" y="59.8" width="6.2" height="5.8" rx="1.4" fill="black" />
          {/* Right 2 windows */}
          <rect x="60.3" y="51.2" width="6.2" height="5.8" rx="1.4" fill="black" />
          <rect x="60.3" y="59.8" width="6.2" height="5.8" rx="1.4" fill="black" />
          {/* Center arched door */}
          <path d="M45.2 69V59.2A4.8 4.8 0 0 1 54.8 59.2V69Z" fill="black" />
        </mask>
      </defs>

      {/* Ground Base Pill */}
      <rect x="21" y="69" width="58" height="4.4" rx="2.2" fill="#FFFFFF" />

      {/* Flagpole & Flag */}
      <rect x="48.8" y="21" width="2.4" height="12" rx="1.2" fill="#FFFFFF" />
      <path d="M50.8 21.5L60.8 24.8L50.8 28.2Z" fill="#FFFFFF" />

      {/* Pitched Roof Overhang */}
      <path
        d="M21 47.5L50 31L79 47.5"
        stroke="#FFFFFF"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Building Body with Cutout Windows & Arch Door */}
      <path
        d="M27.5 46.5L50 33.8L72.5 46.5V69H27.5V46.5Z"
        fill="#FFFFFF"
        mask={`url(#${maskId})`}
      />
    </GlossySquircle>
  );
};

// 3. Học tập & giảng dạy (Lavender-Violet Squircle + White Open Book with Reading Lines)
export const IconSuperLearning: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => {
  const maskId = `learning-mask-${useId().replace(/:/g, '')}`;
  return (
    <GlossySquircle
      className={className}
      size={size}
      topColor="#CEBAFF"
      midColor="#9A72FA"
      bottomColor="#733DF2"
      shadowColor="#6431DF"
    >
      <defs>
        <mask id={maskId}>
          <rect width="100" height="100" fill="white" />
          {/* Left Page 3 Curved Lines */}
          <path
            d="M26.5 43.2C31.5 41.8 38.5 42.2 43.5 44.2"
            stroke="black"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M26.5 49.8C31.5 48.4 38.5 48.8 43.5 50.8"
            stroke="black"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M26.5 56.4C31.5 55 38.5 55.4 43.5 57.4"
            stroke="black"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          {/* Right Page 3 Curved Lines */}
          <path
            d="M73.5 43.2C68.5 41.8 61.5 42.2 56.5 44.2"
            stroke="black"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M73.5 49.8C68.5 48.4 61.5 48.8 56.5 50.8"
            stroke="black"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M73.5 56.4C68.5 55 61.5 55.4 56.5 57.4"
            stroke="black"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </mask>
      </defs>

      <g mask={`url(#${maskId})`} fill="#FFFFFF">
        {/* Left Curved Page */}
        <path d="M21 36.2C29.5 33.2 40.8 34 48.3 38.2V66.8C40.8 62.6 29.5 61.8 21 64.8V36.2Z" />
        {/* Right Curved Page */}
        <path d="M79 36.2C70.5 33.2 59.2 34 51.7 38.2V66.8C59.2 62.6 70.5 61.8 79 64.8V36.2Z" />
      </g>
    </GlossySquircle>
  );
};

// 4. Thư viện thông minh (Peach-Orange Squircle + 3 White Books on Shelf)
export const IconSuperLibrary: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => {
  const maskId = `library-mask-${useId().replace(/:/g, '')}`;
  return (
    <GlossySquircle
      className={className}
      size={size}
      topColor="#FFD39B"
      midColor="#FA9D4C"
      bottomColor="#F07B1F"
      shadowColor="#D96B16"
    >
      <defs>
        <mask id={maskId}>
          <rect width="100" height="100" fill="white" />
          {/* Left Book Bands */}
          <rect x="24" y="42.5" width="12" height="2.6" fill="black" />
          <rect x="24" y="58.5" width="12" height="2.6" fill="black" />
          {/* Middle Book Bands */}
          <rect x="37" y="38" width="12" height="2.6" fill="black" />
          <rect x="37" y="58.5" width="12" height="2.6" fill="black" />
          {/* Right Tilted Book Bands */}
          <g transform="rotate(16 56 65)">
            <rect x="54.5" y="41.5" width="11.5" height="2.6" fill="black" />
            <rect x="54.5" y="58" width="11.5" height="2.6" fill="black" />
          </g>
        </mask>
      </defs>

      {/* Shelf Bar */}
      <rect x="21" y="69" width="58" height="4.4" rx="2.2" fill="#FFFFFF" />

      {/* 3 Books with Spine Band Cutouts */}
      <g mask={`url(#${maskId})`} fill="#FFFFFF">
        <rect x="24.5" y="36" width="10" height="30.5" rx="2.6" />
        <rect x="37" y="31" width="10.4" height="35.5" rx="2.8" />
        <g transform="rotate(16 56 65)">
          <rect x="55" y="35.5" width="9.8" height="30.5" rx="2.6" />
        </g>
      </g>
    </GlossySquircle>
  );
};

// 5. Dịch vụ học sinh (Ice-Cyan to Cerulean Squircle + White Bubble with Heart Cutout)
export const IconSuperServices: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => {
  const maskId = `services-mask-${useId().replace(/:/g, '')}`;
  return (
    <GlossySquircle
      className={className}
      size={size}
      topColor="#8CE5FF"
      midColor="#3FAFFA"
      bottomColor="#1A86F2"
      shadowColor="#1473D6"
    >
      <defs>
        <mask id={maskId}>
          <rect width="100" height="100" fill="white" />
          <path
            d="M50 56.2C50 56.2 38.8 49.4 38.8 42.6C38.8 39.2 41.4 36.6 44.8 36.6C46.9 36.6 48.8 37.7 50 39.4C51.2 37.7 53.1 36.6 55.2 36.6C58.6 36.6 61.2 39.2 61.2 42.6C61.2 49.4 50 56.2 50 56.2Z"
            fill="black"
          />
        </mask>
      </defs>

      <g mask={`url(#${maskId})`} fill="#FFFFFF">
        <rect x="23" y="28" width="54" height="35.5" rx="13" />
        <path d="M35.5 60.5L32.5 72.5L45.5 62.5Z" />
      </g>
    </GlossySquircle>
  );
};

// 6. Truyền thông (Lime-to-Emerald Squircle + White Megaphone & 2 Sound Waves)
export const IconSuperCommunication: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => (
  <GlossySquircle
    className={className}
    size={size}
    topColor="#A7EB7C"
    midColor="#4DC363"
    bottomColor="#219B4A"
    shadowColor="#19833C"
  >
    {/* Megaphone Left Back Cap */}
    <rect x="21.5" y="42.5" width="11.2" height="12.5" rx="4.2" fill="#FFFFFF" />
    {/* Megaphone Handle */}
    <rect
      x="28.5"
      y="54.2"
      width="7.2"
      height="17"
      rx="3"
      transform="rotate(-14 31 56)"
      fill="#FFFFFF"
    />
    {/* Megaphone Flaring Cone */}
    <path
      d="M35 42.8L62 29.5C63.6 28.7 65.2 29.8 65.2 31.6V65.6C65.2 67.4 63.6 68.5 62 67.7L35 54.4V42.8Z"
      fill="#FFFFFF"
    />
    {/* 2 Curved Sound Wave Arcs */}
    <path
      d="M70.2 40.8C73 44.8 73 52.4 70.2 56.4"
      stroke="#FFFFFF"
      strokeWidth="3.6"
      strokeLinecap="round"
    />
    <path
      d="M76 34.8C80.5 41.2 80.5 56 76 62.4"
      stroke="#FFFFFF"
      strokeWidth="3.6"
      strokeLinecap="round"
    />
  </GlossySquircle>
);

// 7. Cơ sở vật chất (Periwinkle-Indigo Squircle + White 2-Building Campus Silhouette)
export const IconSuperFacilities: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => {
  const maskId = `facilities-mask-${useId().replace(/:/g, '')}`;
  return (
    <GlossySquircle
      className={className}
      size={size}
      topColor="#96A7FF"
      midColor="#5F6DF6"
      bottomColor="#3640E6"
      shadowColor="#2D36CC"
    >
      <defs>
        <mask id={maskId}>
          <rect width="100" height="100" fill="white" />
          {/* Tall Left Building 3x2 Windows */}
          <rect x="30.5" y="32.5" width="5.5" height="5.5" rx="1.4" fill="black" />
          <rect x="39" y="32.5" width="5.5" height="5.5" rx="1.4" fill="black" />
          <rect x="30.5" y="40.8" width="5.5" height="5.5" rx="1.4" fill="black" />
          <rect x="39" y="40.8" width="5.5" height="5.5" rx="1.4" fill="black" />
          <rect x="30.5" y="49.1" width="5.5" height="5.5" rx="1.4" fill="black" />
          <rect x="39" y="49.1" width="5.5" height="5.5" rx="1.4" fill="black" />
          {/* Tall Left Building Arched Door */}
          <path d="M33.5 67V60.2A4 4 0 0 1 41.5 60.2V67Z" fill="black" />
          {/* Shorter Right Building 2x2 Windows */}
          <rect x="57" y="46.5" width="5" height="5" rx="1.2" fill="black" />
          <rect x="64" y="46.5" width="5" height="5" rx="1.2" fill="black" />
          <rect x="57" y="54" width="5" height="5" rx="1.2" fill="black" />
          <rect x="64" y="54" width="5" height="5" rx="1.2" fill="black" />
        </mask>
      </defs>

      {/* Ground Base Pill */}
      <rect x="20" y="68.5" width="60" height="4.4" rx="2.2" fill="#FFFFFF" />

      {/* Campus Buildings */}
      <g mask={`url(#${maskId})`} fill="#FFFFFF">
        <rect x="25.5" y="27" width="24" height="40" rx="4" />
        <rect x="53" y="41" width="19.5" height="26" rx="3.5" />
      </g>
    </GlossySquircle>
  );
};

// 8. Phân tích & AI (Rose-Pink to Orchid-Purple Squircle + 3 Ascending Bars + 2 Sparkles)
export const IconSuperAnalytics: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => (
  <GlossySquircle
    className={className}
    size={size}
    topColor="#F7A4F2"
    midColor="#D162E9"
    bottomColor="#B236DD"
    shadowColor="#9928C4"
  >
    {/* Horizontal Base Pill */}
    <rect x="21" y="68.5" width="46" height="4.2" rx="2.1" fill="#FFFFFF" />
    {/* 3 Ascending Rounded Bars */}
    <rect x="24" y="51.5" width="10.2" height="15" rx="3" fill="#FFFFFF" />
    <rect x="37.2" y="41.5" width="10.2" height="25" rx="3" fill="#FFFFFF" />
    <rect x="50.4" y="32" width="10.2" height="34.5" rx="3" fill="#FFFFFF" />
    {/* Large 4-Point Sparkle */}
    <path
      d="M73.5 21C74.2 26.2 76.3 28.3 81.5 29C76.3 29.7 74.2 31.8 73.5 37C72.8 31.8 70.7 29.7 65.5 29C70.7 28.3 72.8 26.2 73.5 21Z"
      fill="#FFFFFF"
    />
    {/* Small 4-Point Sparkle */}
    <path
      d="M77 42.5C77.4 45.6 78.6 46.8 81.8 47.2C78.6 47.6 77.4 48.8 77 52C76.6 48.8 75.4 47.6 72.2 47.2C75.4 46.8 76.6 45.6 77 42.5Z"
      fill="#FFFFFF"
    />
  </GlossySquircle>
);

// 9. Học tập theo môn (Sky-Cyan to Cobalt Squircle + White Layered Academic Workbook & Sparkle)
export const IconSuperSubjects: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => {
  const maskId = `subjects-mask-${useId().replace(/:/g, '')}`;
  return (
    <GlossySquircle
      className={className}
      size={size}
      topColor="#74DFFD"
      midColor="#2BA2F6"
      bottomColor="#136AE6"
      shadowColor="#0F58C7"
    >
      <defs>
        <mask id={maskId}>
          <rect width="100" height="100" fill="white" />
          {/* Inner cutout lines */}
          <rect x="31" y="41" width="21" height="3.2" rx="1.6" fill="black" />
          <rect x="31" y="48.5" width="16" height="3.2" rx="1.6" fill="black" />
          <rect x="31" y="56" width="12" height="3.2" rx="1.6" fill="black" />
        </mask>
      </defs>

      {/* Main Rounded Notebook */}
      <rect
        x="24"
        y="30"
        width="39"
        height="41"
        rx="8"
        fill="#FFFFFF"
        mask={`url(#${maskId})`}
      />
      {/* Floating Top-Right Academic Star Badge */}
      <circle cx="67.5" cy="36.5" r="11.5" fill="rgba(255,255,255,0.28)" stroke="#FFFFFF" strokeWidth="2.4" />
      <path
        d="M67.5 30.2L69.3 34.4L73.8 34.8L70.4 37.8L71.4 42.2L67.5 39.9L63.6 42.2L64.6 37.8L61.2 34.8L65.7 34.4L67.5 30.2Z"
        fill="#FFFFFF"
      />
    </GlossySquircle>
  );
};

// 10. Trợ lý AI (Turquoise-Teal Squircle + White AI Copilot Head & Sparkle)
export const IconSuperAIAssistant: React.FC<IconProps> = ({ className = 'w-14 h-14', size }) => {
  const maskId = `ai-assistant-mask-${useId().replace(/:/g, '')}`;
  return (
    <GlossySquircle
      className={className}
      size={size}
      topColor="#74F2E8"
      midColor="#15C7B9"
      bottomColor="#0B928A"
      shadowColor="#08766F"
    >
      <defs>
        <mask id={maskId}>
          <rect width="100" height="100" fill="white" />
          {/* Friendly AI Visor Eyes Cutout */}
          <rect x="35" y="45" width="7.2" height="9" rx="3.6" fill="black" />
          <rect x="53" y="45" width="7.2" height="9" rx="3.6" fill="black" />
          {/* Subtle Smile Arc */}
          <path
            d="M41.5 59.5C44.8 62.3 50.4 62.3 53.7 59.5"
            stroke="black"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </mask>
      </defs>

      {/* Antenna */}
      <rect x="45.8" y="21" width="3.6" height="9" rx="1.8" fill="#FFFFFF" />
      <circle cx="47.6" cy="20" r="4" fill="#FFFFFF" />

      {/* Side Ear Nodes */}
      <rect x="19" y="44" width="5.5" height="14" rx="2.75" fill="#FFFFFF" />
      <rect x="70.5" y="44" width="5.5" height="14" rx="2.75" fill="#FFFFFF" />

      {/* Main Rounded Assistant Head */}
      <rect
        x="26"
        y="30"
        width="43"
        height="39"
        rx="14"
        fill="#FFFFFF"
        mask={`url(#${maskId})`}
      />

      {/* Base Pill */}
      <rect x="34" y="72.5" width="27" height="4.2" rx="2.1" fill="#FFFFFF" />

      {/* Top-Right 4-Point AI Sparkle */}
      <path
        d="M75 20.5C75.7 25.5 77.7 27.5 82.7 28.2C77.7 28.9 75.7 30.9 75 35.9C74.3 30.9 72.3 28.9 67.3 28.2C72.3 27.5 74.3 25.5 75 20.5Z"
        fill="#FFFFFF"
      />
    </GlossySquircle>
  );
};

/* =====================================================================
   COMPATIBLE LEGACY ALIASES FOR SCHOOLHUB_APP_ICONS (UNIFIED GLOSSY STYLE)
   ===================================================================== */

export const IconOverview: React.FC<IconProps> = (props) => <IconSuperAnalytics {...props} />;
export const IconSystemSettings: React.FC<IconProps> = (props) => <IconSuperAdmin {...props} />;
export const IconCurriculum: React.FC<IconProps> = (props) => <IconSuperLearning {...props} />;
export const IconSmartLibrary: React.FC<IconProps> = (props) => <IconSuperLibrary {...props} />;
export const IconFacilities: React.FC<IconProps> = (props) => <IconSuperFacilities {...props} />;
export const IconReportsAnalytics: React.FC<IconProps> = (props) => <IconSuperAnalytics {...props} />;

export const IconUserManagement: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <GlossySquircle
    className={className}
    size={size}
    topColor="#81B9FF"
    midColor="#4B7CF7"
    bottomColor="#2B58F3"
    shadowColor="#2551E8"
  >
    <circle cx="42" cy="39" r="9" fill="#FFFFFF" />
    <path d="M25 69C25 58 32 52 42 52C52 52 59 58 59 69H25Z" fill="#FFFFFF" />
    <circle cx="64" cy="43" r="7" fill="rgba(255,255,255,0.85)" />
    <path d="M56 69C56 61 60 56 66 56C72 56 76 61 76 69H56Z" fill="rgba(255,255,255,0.85)" />
  </GlossySquircle>
);

export const IconPermissions: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <GlossySquircle
    className={className}
    size={size}
    topColor="#7BEAC2"
    midColor="#2BC695"
    bottomColor="#0FA177"
    shadowColor="#0D8F6A"
  >
    <path
      d="M50 24L70 32.5V48.5C70 61.5 61.5 71 50 75C38.5 71 30 61.5 30 48.5V32.5L50 24Z"
      fill="rgba(255,255,255,0.26)"
      stroke="#FFFFFF"
      strokeWidth="4"
      strokeLinejoin="round"
    />
    <path
      d="M40.5 49.5L47.2 56.2L60.5 42.5"
      stroke="#FFFFFF"
      strokeWidth="4.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </GlossySquircle>
);

export const IconStudents: React.FC<IconProps> = (props) => <IconSuperSchool {...props} />;

export const IconTeachersStaff: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <GlossySquircle
    className={className}
    size={size}
    topColor="#7BEAC2"
    midColor="#2BC695"
    bottomColor="#0FA177"
    shadowColor="#0D8F6A"
  >
    <circle cx="50" cy="36" r="8.5" fill="#FFFFFF" />
    <path d="M34 69C34 57 41 51 50 51C59 51 66 57 66 69H34Z" fill="#FFFFFF" />
  </GlossySquircle>
);

export const IconClassrooms: React.FC<IconProps> = (props) => <IconSuperSchool {...props} />;
export const IconAcademicYear: React.FC<IconProps> = (props) => <IconSuperLearning {...props} />;
export const IconTimetable: React.FC<IconProps> = (props) => <IconSuperLearning {...props} />;

export const IconAttendance: React.FC<IconProps> = ({ className = 'w-12 h-12', size }) => (
  <GlossySquircle
    className={className}
    size={size}
    topColor="#A7EB7C"
    midColor="#4DC363"
    bottomColor="#219B4A"
    shadowColor="#19833C"
  >
    <rect x="26" y="26" width="48" height="48" rx="14" fill="rgba(255,255,255,0.22)" />
    <path
      d="M37 51.5L46 60.5L64 41"
      stroke="#FFFFFF"
      strokeWidth="5.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </GlossySquircle>
);

export const IconSurveys: React.FC<IconProps> = (props) => <IconSuperServices {...props} />;
export const IconFeedback: React.FC<IconProps> = (props) => <IconSuperServices {...props} />;
export const IconCounseling: React.FC<IconProps> = (props) => <IconSuperServices {...props} />;
export const IconAnnouncements: React.FC<IconProps> = (props) => <IconSuperCommunication {...props} />;

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
  'ai-assistant': IconSuperAIAssistant,
};
