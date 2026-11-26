import React from 'react';
import {
  Activity as LucideActivity,
  Archive as LucideArchive,
  ArrowLeftRight as LucideArrowLeftRight,
  Atom as LucideAtom,
  Award as LucideAward,
  BarChart2 as LucideBarChart2,
  BarChart3 as LucideBarChart3,
  Barcode as LucideBarcode,
  BookCheck as LucideBookCheck,
  BookOpen as LucideBookOpen,
  BookOpenCheck as LucideBookOpenCheck,
  BookPlus as LucideBookPlus,
  Bookmark as LucideBookmark,
  Brain as LucideBrain,
  BrainCircuit as LucideBrainCircuit,
  Briefcase as LucideBriefcase,
  Building2 as LucideBuilding2,
  Calculator as LucideCalculator,
  CalendarCheck as LucideCalendarCheck,
  CalendarDays as LucideCalendarDays,
  CalendarRange as LucideCalendarRange,
  CheckSquare as LucideCheckSquare,
  ClipboardCheck as LucideClipboardCheck,
  ClipboardList as LucideClipboardList,
  ClipboardPlus as LucideClipboardPlus,
  Code2 as LucideCode2,
  Compass as LucideCompass,
  Cpu as LucideCpu,
  CreditCard as LucideCreditCard,
  Database as LucideDatabase,
  DoorOpen as LucideDoorOpen,
  Feather as LucideFeather,
  FileCheck as LucideFileCheck,
  FileCode2 as LucideFileCode2,
  FileDown as LucideFileDown,
  FileSpreadsheet as LucideFileSpreadsheet,
  FileText as LucideFileText,
  FlaskConical as LucideFlaskConical,
  FolderOpen as LucideFolderOpen,
  Gauge as LucideGauge,
  Globe as LucideGlobe,
  GraduationCap as LucideGraduationCap,
  HeartHandshake as LucideHeartHandshake,
  ImagePlus as LucideImagePlus,
  Landmark as LucideLandmark,
  Languages as LucideLanguages,
  LifeBuoy as LucideLifeBuoy,
  Lightbulb as LucideLightbulb,
  List as LucideList,
  MessageSquareWarning as LucideMessageSquareWarning,
  Monitor as LucideMonitor,
  PieChart as LucidePieChart,
  Pin as LucidePin,
  ScanLine as LucideScanLine,
  School as LucideSchool,
  Square as LucideSquare,
  Thermometer as LucideThermometer,
  TrendingDown as LucideTrendingDown,
  TrendingUp as LucideTrendingUp,
  Trophy as LucideTrophy,
  Tv as LucideTv,
  Usb as LucideUsb,
  UserCheck as LucideUserCheck,
  Wifi as LucideWifi,
  WifiOff as LucideWifiOff,
  Wind as LucideWind,
  Wrench as LucideWrench,
  Zap as LucideZap,
} from 'lucide-react';

export interface UiIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
}

export type LucideIcon = React.FC<UiIconProps>;

function createIcon(
  displayName: string,
  renderPaths: (props: { strokeWidth: number | string }) => React.ReactNode
): LucideIcon {
  const Comp: LucideIcon = ({
    size,
    strokeWidth = 1.9,
    absoluteStrokeWidth: _abs,
    className = '',
    style,
    ...rest
  }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={`ui-line-icon shrink-0 ${className}`.trim()}
      style={size ? { width: size, height: size, ...style } : style}
      aria-hidden={rest['aria-label'] ? undefined : true}
      {...rest}
    >
      {renderPaths({ strokeWidth })}
    </svg>
  );
  Comp.displayName = displayName;
  return Comp;
}

function wrapUniformIcon(
  displayName: string,
  LucideComp: React.FC<UiIconProps>
): LucideIcon {
  const Comp: LucideIcon = ({ strokeWidth = 1.9, className = '', ...rest }) => (
    <LucideComp
      strokeWidth={strokeWidth}
      className={`ui-line-icon shrink-0 ${className}`.trim()}
      {...rest}
    />
  );
  Comp.displayName = displayName;
  return Comp;
}

/* =====================================================================
   20 CORE UI ICONS — FAITHFUL TO REFERENCE SHEET (image_53d039bd.png)
   Rounded deep-navy stroke aesthetic (currentColor + strokeWidth 1.9)
   ===================================================================== */

// 1. Home (Pitched roof house + arched center doorway)
export const Home = createIcon('Home', () => (
  <>
    <path d="M3.5 10.5L12 3.5L20.5 10.5" />
    <path d="M5.5 9V19C5.5 20.1 6.4 21 7.5 21H16.5C17.6 21 18.5 20.1 18.5 19V9" />
    <path d="M9.5 21V15C9.5 13.6 10.6 12.5 12 12.5C13.4 12.5 14.5 13.6 14.5 15V21" />
  </>
));

// 2. Search
export const Search = createIcon('Search', () => (
  <>
    <circle cx="10.8" cy="10.8" r="6.8" />
    <path d="M15.8 15.8L20.2 20.2" />
  </>
));

// 3. Filter
export const Filter = createIcon('Filter', () => (
  <path d="M4.2 5.2H19.8L13.8 12.4V17.8L10.2 19.6V12.4L4.2 5.2Z" />
));

// 4. Plus
export const Plus = createIcon('Plus', () => (
  <>
    <path d="M12 5V19" />
    <path d="M5 12H19" />
  </>
));

// 5. Pencil / Edit
export const Pencil = createIcon('Pencil', () => (
  <>
    <path d="M16.2 4.2C17 3.4 18.3 3.4 19.1 4.2L19.8 4.9C20.6 5.7 20.6 7 19.8 7.8L8.6 19L4 20L5 15.4L16.2 4.2Z" />
    <path d="M14.2 6.2L17.8 9.8" />
  </>
));

// 6. Trash2 / Delete
export const Trash2 = createIcon('Trash2', () => (
  <>
    <path d="M4.5 7H19.5" />
    <path d="M9 7V5.2C9 4.4 9.7 3.8 10.5 3.8H13.5C14.3 3.8 15 4.4 15 5.2V7" />
    <path d="M6.5 7L7.4 18.8C7.5 19.9 8.4 20.8 9.5 20.8H14.5C15.6 20.8 16.5 19.9 16.6 18.8L17.5 7" />
    <path d="M10.2 11.2V16.5" />
    <path d="M13.8 11.2V16.5" />
  </>
));

// 7. Calendar (Rounded frame, top pins, header line, 4-dot grid)
export const Calendar = createIcon('Calendar', () => (
  <>
    <rect x="4" y="5" width="16" height="15.5" rx="3" />
    <path d="M8.5 3.2V6.2" />
    <path d="M15.5 3.2V6.2" />
    <path d="M4 9.8H20" />
    <circle cx="8.5" cy="13.8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="12" cy="13.8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="13.8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
  </>
));

// 8. Clock
export const Clock = createIcon('Clock', () => (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12.2L15 14.2" />
  </>
));

// 9. MapPin
export const MapPin = createIcon('MapPin', () => (
  <>
    <path d="M12 21C12 21 5.5 15.2 5.5 10C5.5 6.4 8.4 3.5 12 3.5C15.6 3.5 18.5 6.4 18.5 10C18.5 15.2 12 21 12 21Z" />
    <circle cx="12" cy="10" r="2.4" />
  </>
));

// 10. MessageSquare (Rounded speech bubble with 3 centered dots)
export const MessageSquare = createIcon('MessageSquare', () => (
  <>
    <path d="M5.5 4.5H18.5C19.9 4.5 21 5.6 21 7V14.5C21 15.9 19.9 17 18.5 17H9.5L5.2 20.5V17C3.9 16.8 3 15.8 3 14.5V7C3 5.6 4.1 4.5 5.5 4.5Z" />
    <circle cx="8.5" cy="10.8" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="10.8" r="1" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="10.8" r="1" fill="currentColor" stroke="none" />
  </>
));

// 11. User
export const User = createIcon('User', () => (
  <>
    <circle cx="12" cy="8.2" r="3.6" />
    <path d="M5.2 19.8C6 16.3 8.8 14.4 12 14.4C15.2 14.4 18 16.3 18.8 19.8" />
  </>
));

// 12. Settings (Rounded hollow 8-tooth gear)
export const Settings = createIcon('Settings', () => (
  <>
    <circle cx="12" cy="12" r="2.8" />
    <path d="M19.4 15A1.65 1.65 0 0 0 19.7 16.8L19.8 16.9A2 2 0 0 1 16.9 19.8L16.8 19.7A1.65 1.65 0 0 0 15 19.4A1.65 1.65 0 0 0 14 20.9V21A2 2 0 0 1 10 21V20.9A1.65 1.65 0 0 0 9 19.4A1.65 1.65 0 0 0 7.2 19.7L7.1 19.8A2 2 0 0 1 4.2 16.9L4.3 16.8A1.65 1.65 0 0 0 4.6 15A1.65 1.65 0 0 0 3.1 14H3A2 2 0 0 1 3 10H3.1A1.65 1.65 0 0 0 4.6 9A1.65 1.65 0 0 0 4.3 7.2L4.2 7.1A2 2 0 0 1 7.1 4.2L7.2 4.3A1.65 1.65 0 0 0 9 4.6H9A1.65 1.65 0 0 0 10 3.1V3A2 2 0 0 1 14 3V3.1A1.65 1.65 0 0 0 15 4.6A1.65 1.65 0 0 0 16.8 4.3L16.9 4.2A2 2 0 0 1 19.8 7.1L19.7 7.2A1.65 1.65 0 0 0 19.4 9V9A1.65 1.65 0 0 0 20.9 10H21A2 2 0 0 1 21 14H20.9A1.65 1.65 0 0 0 19.4 15Z" />
  </>
));

// 13. Download
export const Download = createIcon('Download', () => (
  <>
    <path d="M12 4.5V15" />
    <path d="M8 11.2L12 15.2L16 11.2" />
    <path d="M4.5 15.5V18C4.5 19.1 5.4 20 6.5 20H17.5C18.6 20 19.5 19.1 19.5 18V15.5" />
  </>
));

// 14. Upload
export const Upload = createIcon('Upload', () => (
  <>
    <path d="M12 15.2V4.8" />
    <path d="M8 8.6L12 4.6L16 8.6" />
    <path d="M4.5 15.5V18C4.5 19.1 5.4 20 6.5 20H17.5C18.6 20 19.5 19.1 19.5 18V15.5" />
  </>
));

// 15. Printer
export const Printer = createIcon('Printer', () => (
  <>
    <path d="M7.2 8.2V4.5C7.2 3.9 7.7 3.5 8.2 3.5H15.8C16.3 3.5 16.8 3.9 16.8 4.5V8.2" />
    <path d="M6.8 16.5H5C4.2 16.5 3.5 15.8 3.5 15V10.5C3.5 9.2 4.5 8.2 5.8 8.2H18.2C19.5 8.2 20.5 9.2 20.5 10.5V15C20.5 15.8 19.8 16.5 19 16.5H17.2" />
    <rect x="7" y="13.8" width="10" height="6.4" rx="1.2" />
  </>
));

// 16. Link2
export const Link2 = createIcon('Link2', () => (
  <>
    <path d="M9.8 14.2L14.2 9.8" />
    <path d="M8.4 10.6L6.2 12.8C4.6 14.4 4.6 16.9 6.2 18.4C7.7 20 10.2 20 11.8 18.4L14 16.2" />
    <path d="M10 7.8L12.2 5.6C13.8 4 16.3 4 17.8 5.6C19.4 7.1 19.4 9.6 17.8 11.2L15.6 13.4" />
  </>
));

// 17. ShieldCheck
export const ShieldCheck = createIcon('ShieldCheck', () => (
  <>
    <path d="M12 3.5L19 6.4V11.6C19 16.1 16 19.5 12 20.8C8 19.5 5 16.1 5 11.6V6.4L12 3.5Z" />
    <path d="M9.2 12.1L11.2 14.1L15 10.2" />
  </>
));

// 18. Star
export const Star = createIcon('Star', () => (
  <path d="M12 3.8L14.5 8.9L20.1 9.7L16 13.7L17 19.3L12 16.7L7 19.3L8 13.7L3.9 9.7L9.5 8.9L12 3.8Z" />
));

// 19. Heart
export const Heart = createIcon('Heart', () => (
  <path d="M12 19.8C12 19.8 4.2 14.8 4.2 9.2C4.2 6.5 6.3 4.5 8.8 4.5C10.3 4.5 11.4 5.2 12 6.3C12.6 5.2 13.7 4.5 15.2 4.5C17.7 4.5 19.8 6.5 19.8 9.2C19.8 14.8 12 19.8 12 19.8Z" />
));

// 20. MoreHorizontal
export const MoreHorizontal = createIcon('MoreHorizontal', () => (
  <>
    <circle cx="6.2" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="17.8" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </>
));

/* =====================================================================
   CORE SHELL, NAVIGATION & SHARED UI ICONS (SAME LINE STYLE)
   ===================================================================== */

export const Bell = createIcon('Bell', () => (
  <>
    <path d="M18 8.5C18 5.2 15.3 3 12 3C8.7 3 6 5.2 6 8.5C6 13.5 4.2 15.5 3.5 16.5H20.5C19.8 15.5 18 13.5 18 8.5Z" />
    <path d="M10 19.5C10.4 20.4 11.1 21 12 21C12.9 21 13.6 20.4 14 19.5" />
  </>
));

export const CloudSun = createIcon('CloudSun', () => (
  <>
    <path d="M12 3V4.5" />
    <path d="M5.6 5.6L6.7 6.7" />
    <path d="M18.4 5.6L17.3 6.7" />
    <path d="M15.8 11.5C15.9 11.1 16 10.6 16 10.1C16 7.9 14.2 6.1 12 6.1C10.1 6.1 8.5 7.4 8.1 9.2" />
    <path d="M7.5 19.5H16.5C18.4 19.5 20 18 20 16.1C20 14.3 18.6 12.8 16.8 12.7C16.2 10.6 14.3 9.2 12.1 9.2C9.5 9.2 7.4 11.1 7.2 13.6C5.4 13.9 4 15.4 4 17.2C4 18.5 5.6 19.5 7.5 19.5Z" />
  </>
));

export const LayoutGrid = createIcon('LayoutGrid', () => (
  <>
    <rect x="4" y="4" width="6.8" height="6.8" rx="1.8" />
    <rect x="13.2" y="4" width="6.8" height="6.8" rx="1.8" />
    <rect x="4" y="13.2" width="6.8" height="6.8" rx="1.8" />
    <rect x="13.2" y="13.2" width="6.8" height="6.8" rx="1.8" />
  </>
));

export const LayoutDashboard = createIcon('LayoutDashboard', () => (
  <>
    <rect x="4" y="4" width="7" height="9" rx="1.8" />
    <rect x="13" y="4" width="7" height="5.2" rx="1.8" />
    <rect x="13" y="11" width="7" height="9" rx="1.8" />
    <rect x="4" y="15" width="7" height="5" rx="1.8" />
  </>
));

export const Users = createIcon('Users', () => (
  <>
    <circle cx="9.2" cy="8.2" r="3.2" />
    <path d="M3.5 19.5C4.2 16.3 6.5 14.6 9.2 14.6C11.9 14.6 14.2 16.3 14.9 19.5" />
    <circle cx="16.2" cy="9.2" r="2.5" />
    <path d="M16.5 14.8C18.6 15.2 20.1 16.7 20.6 19.5" />
  </>
));

export const Shield = createIcon('Shield', () => (
  <path d="M12 3.5L19 6.4V11.6C19 16.1 16 19.5 12 20.8C8 19.5 5 16.1 5 11.6V6.4L12 3.5Z" />
));

export const ShieldAlert = createIcon('ShieldAlert', () => (
  <>
    <path d="M12 3.5L19 6.4V11.6C19 16.1 16 19.5 12 20.8C8 19.5 5 16.1 5 11.6V6.4L12 3.5Z" />
    <path d="M12 8.5V12.5" />
    <circle cx="12" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
  </>
));

export const Lock = createIcon('Lock', () => (
  <>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
    <path d="M8 10.5V7.5C8 5.3 9.8 3.5 12 3.5C14.2 3.5 16 5.3 16 7.5V10.5" />
  </>
));

export const Unlock = createIcon('Unlock', () => (
  <>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
    <path d="M8 10.5V7.5C8 5.3 9.8 3.5 12 3.5C13.8 3.5 15.3 4.7 15.8 6.3" />
  </>
));

export const History = createIcon('History', () => (
  <>
    <path d="M4.2 12A7.8 7.8 0 1 0 6.5 6.5L4 9" />
    <path d="M4 4.5V9H8.5" />
    <path d="M12 8V12.2L14.8 13.8" />
  </>
));

export const RefreshCw = createIcon('RefreshCw', () => (
  <>
    <path d="M20 11A8 8 0 0 0 6.4 6.2L4.2 8.4" />
    <path d="M4.2 4.4V8.4H8.2" />
    <path d="M4 13A8 8 0 0 0 17.6 17.8L19.8 15.6" />
    <path d="M19.8 19.6V15.6H15.8" />
  </>
));

export const RotateCcw = createIcon('RotateCcw', () => (
  <>
    <path d="M4.5 10.5A7.8 7.8 0 1 1 5.4 16" />
    <path d="M4.5 5.5V10.5H9.5" />
  </>
));

export const LogIn = createIcon('LogIn', () => (
  <>
    <path d="M14.5 4H17.5C18.9 4 20 5.1 20 6.5V17.5C20 18.9 18.9 20 17.5 20H14.5" />
    <path d="M10.5 16L14.5 12L10.5 8" />
    <path d="M14.5 12H4" />
  </>
));

export const LogOut = createIcon('LogOut', () => (
  <>
    <path d="M9.5 4H6.5C5.1 4 4 5.1 4 6.5V17.5C4 18.9 5.1 20 6.5 20H9.5" />
    <path d="M15.5 16L19.5 12L15.5 8" />
    <path d="M19.5 12H9" />
  </>
));

export const Power = createIcon('Power', () => (
  <>
    <path d="M12 3.5V11.5" />
    <path d="M17.5 6.8A8 8 0 1 1 6.5 6.8" />
  </>
));

export const Sun = createIcon('Sun', () => (
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3V5" />
    <path d="M12 19V21" />
    <path d="M4.9 4.9L6.3 6.3" />
    <path d="M17.7 17.7L19.1 19.1" />
    <path d="M3 12H5" />
    <path d="M19 12H21" />
    <path d="M4.9 19.1L6.3 17.7" />
    <path d="M17.7 6.3L19.1 4.9" />
  </>
));

export const Moon = createIcon('Moon', () => (
  <path d="M19.5 14.2A7.8 7.8 0 0 1 9.8 4.5A8.2 8.2 0 1 0 19.5 14.2Z" />
));

export const X = createIcon('X', () => (
  <>
    <path d="M6 6L18 18" />
    <path d="M18 6L6 18" />
  </>
));

export const XCircle = createIcon('XCircle', () => (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.2 9.2L14.8 14.8" />
    <path d="M14.8 9.2L9.2 14.8" />
  </>
));

export const Check = createIcon('Check', () => (
  <path d="M5 12.5L9.8 17.2L19 7.8" />
));

export const CheckCheck = createIcon('CheckCheck', () => (
  <>
    <path d="M3.5 12.5L7.8 16.8L16.5 7.8" />
    <path d="M11 16.8L19.8 7.8" />
  </>
));

export const CheckCircle2 = createIcon('CheckCircle2', () => (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.8 12.2L11 14.4L15.4 9.8" />
  </>
));

export const AlertCircle = createIcon('AlertCircle', () => (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8V12.5" />
    <circle cx="12" cy="15.8" r="0.9" fill="currentColor" stroke="none" />
  </>
));

export const AlertTriangle = createIcon('AlertTriangle', () => (
  <>
    <path d="M10.5 4.6L3.6 17C2.9 18.2 3.8 19.6 5.1 19.6H18.9C20.2 19.6 21.1 18.2 20.4 17L13.5 4.6C12.8 3.4 11.2 3.4 10.5 4.6Z" />
    <path d="M12 9.2V13.2" />
    <circle cx="12" cy="16.2" r="0.9" fill="currentColor" stroke="none" />
  </>
));

export const ArrowRight = createIcon('ArrowRight', () => (
  <>
    <path d="M5 12H19" />
    <path d="M13.5 6.5L19 12L13.5 17.5" />
  </>
));

export const ArrowUp = createIcon('ArrowUp', () => (
  <>
    <path d="M12 19V5" />
    <path d="M6.5 10.5L12 5L17.5 10.5" />
  </>
));

export const ArrowDown = createIcon('ArrowDown', () => (
  <>
    <path d="M12 5V19" />
    <path d="M6.5 13.5L12 19L17.5 13.5" />
  </>
));

export const ChevronLeft = createIcon('ChevronLeft', () => (
  <path d="M14.8 6L8.8 12L14.8 18" />
));

export const ChevronRight = createIcon('ChevronRight', () => (
  <path d="M9.2 6L15.2 12L9.2 18" />
));

export const Maximize2 = createIcon('Maximize2', () => (
  <>
    <path d="M15 4.5H19.5V9" />
    <path d="M9 19.5H4.5V15" />
    <path d="M19.5 4.5L14 10" />
    <path d="M4.5 19.5L10 14" />
  </>
));

export const Minimize2 = createIcon('Minimize2', () => (
  <>
    <path d="M4.5 14.5H9.5V19.5" />
    <path d="M19.5 9.5H14.5V4.5" />
    <path d="M14.5 9.5L20 4" />
    <path d="M9.5 14.5L4 20" />
  </>
));

export const Layers = createIcon('Layers', () => (
  <>
    <path d="M12 3.8L20 8L12 12.2L4 8L12 3.8Z" />
    <path d="M4 12.2L12 16.4L20 12.2" />
    <path d="M4 16.4L12 20.4L20 16.4" />
  </>
));

export const Cloud = createIcon('Cloud', () => (
  <path d="M7.2 18.5H16.8C19.1 18.5 21 16.7 21 14.4C21 12.3 19.4 10.6 17.4 10.4C16.7 7.6 14.2 5.5 11.2 5.5C7.8 5.5 5 8.1 4.9 11.5C3.5 12 2.5 13.3 2.5 14.9C2.5 16.9 4.6 18.5 7.2 18.5Z" />
));

export const CloudOff = createIcon('CloudOff', () => (
  <>
    <path d="M4 4L20 20" />
    <path d="M9.5 5.8C10.1 5.6 10.6 5.5 11.2 5.5C14.2 5.5 16.7 7.6 17.4 10.4C19.4 10.6 21 12.3 21 14.4C21 15.5 20.5 16.5 19.8 17.2" />
    <path d="M16.8 18.5H7.2C4.6 18.5 2.5 16.9 2.5 14.9C2.5 13.3 3.5 12 4.9 11.5C5 10.5 5.3 9.6 5.8 8.8" />
  </>
));

export const Bot = createIcon('Bot', () => (
  <>
    <path d="M12 4V7" />
    <circle cx="12" cy="3.5" r="1" fill="currentColor" stroke="none" />
    <rect x="4.5" y="7" width="15" height="12.5" rx="3.2" />
    <circle cx="9.2" cy="12.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="14.8" cy="12.5" r="1" fill="currentColor" stroke="none" />
    <path d="M9.5 16H14.5" />
    <path d="M2.5 12V14.5" />
    <path d="M21.5 12V14.5" />
  </>
));

export const Sparkles = createIcon('Sparkles', () => (
  <>
    <path d="M11 3.5L12.6 8.4L17.5 10L12.6 11.6L11 16.5L9.4 11.6L4.5 10L9.4 8.4L11 3.5Z" />
    <path d="M18 15L18.7 17L20.7 17.7L18.7 18.4L18 20.4L17.3 18.4L15.3 17.7L17.3 17L18 15Z" />
  </>
));

export const Send = createIcon('Send', () => (
  <>
    <path d="M20.2 4.2L10.6 13.8" />
    <path d="M20.2 4.2L14 20.2L10.4 13.6L3.8 10L20.2 4.2Z" />
  </>
));

export const Mail = createIcon('Mail', () => (
  <>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="M4.2 7L12 12.6L19.8 7" />
  </>
));

export const Phone = createIcon('Phone', () => (
  <path d="M6.2 4.5H9.1L10.5 8.1L8.7 9.4C9.7 11.5 11.5 13.3 13.6 14.3L14.9 12.5L18.5 13.9V16.8C18.5 18.1 17.4 19.2 16 19.1C9.8 18.6 4.9 13.7 4.4 7.5C4.3 6.1 5.1 4.5 6.2 4.5Z" />
));

export const Image = createIcon('Image', () => (
  <>
    <rect x="4" y="4.5" width="16" height="15" rx="2.8" />
    <circle cx="9" cy="9.5" r="1.4" />
    <path d="M20 15.5L15.6 11.5L7 19.5" />
  </>
));

export const Play = createIcon('Play', () => (
  <path d="M7.2 5.4L18.5 12L7.2 18.6V5.4Z" />
));

export const Pause = createIcon('Pause', () => (
  <>
    <rect x="6.5" y="5.2" width="3.8" height="13.6" rx="1.2" />
    <rect x="13.7" y="5.2" width="3.8" height="13.6" rx="1.2" />
  </>
));

export const Eye = createIcon('Eye', () => (
  <>
    <path d="M2.8 12C4.8 7.8 8.1 5.8 12 5.8C15.9 5.8 19.2 7.8 21.2 12C19.2 16.2 15.9 18.2 12 18.2C8.1 18.2 4.8 16.2 2.8 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </>
));

export const EyeOff = createIcon('EyeOff', () => (
  <>
    <path d="M4 4L20 20" />
    <path d="M10.4 6C10.9 5.9 11.5 5.8 12 5.8C15.9 5.8 19.2 7.8 21.2 12C20.4 13.7 19.4 15 18.1 16" />
    <path d="M14.2 17.8C13.5 18.1 12.8 18.2 12 18.2C8.1 18.2 4.8 16.2 2.8 12C3.7 10.1 5 8.6 6.6 7.5" />
  </>
));

export const Copy = createIcon('Copy', () => (
  <>
    <rect x="9" y="8.5" width="11" height="11.5" rx="2.2" />
    <path d="M15 8.5V6.2C15 5 14 4 12.8 4H6.2C5 4 4 5 4 6.2V13.8C4 15 5 16 6.2 16H9" />
  </>
));

export const Save = createIcon('Save', () => (
  <>
    <path d="M16.8 4H6C4.9 4 4 4.9 4 6V18C4 19.1 4.9 20 6 20H18C19.1 20 20 19.1 20 18V7.2L16.8 4Z" />
    <path d="M16 20V13.5H8V20" />
    <path d="M8 4V8.5H14.5" />
  </>
));

export const Sliders = createIcon('Sliders', () => (
  <>
    <path d="M4 7H7" />
    <path d="M11 7H20" />
    <circle cx="9" cy="7" r="2" />
    <path d="M4 12H13" />
    <path d="M17 12H20" />
    <circle cx="15" cy="12" r="2" />
    <path d="M4 17H8" />
    <path d="M12 17H20" />
    <circle cx="10" cy="17" r="2" />
  </>
));

export const ExternalLink = createIcon('ExternalLink', () => (
  <>
    <path d="M14.5 4.5H19.5V9.5" />
    <path d="M11 13L19.5 4.5" />
    <path d="M18.5 13.5V17.5C18.5 18.6 17.6 19.5 16.5 19.5H6.5C5.4 19.5 4.5 18.6 4.5 17.5V7.5C4.5 6.4 5.4 5.5 6.5 5.5H10.5" />
  </>
));

export const HelpCircle = createIcon('HelpCircle', () => (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.6C10 8.3 11.1 7.6 12.2 7.6C13.6 7.6 14.7 8.6 14.7 9.9C14.7 11.1 13.7 11.7 12.6 12.3C12.2 12.5 12 12.9 12 13.5" />
    <circle cx="12" cy="16.2" r="0.9" fill="currentColor" stroke="none" />
  </>
));

/* =====================================================================
   UNIFORM ROUNDED DOMAIN ICONS (1.9px STROKE HARMONIZED SET)
   ===================================================================== */

export const Activity = wrapUniformIcon('Activity', LucideActivity);
export const Archive = wrapUniformIcon('Archive', LucideArchive);
export const ArrowLeftRight = wrapUniformIcon('ArrowLeftRight', LucideArrowLeftRight);
export const Atom = wrapUniformIcon('Atom', LucideAtom);
export const Award = wrapUniformIcon('Award', LucideAward);
export const BarChart2 = wrapUniformIcon('BarChart2', LucideBarChart2);
export const BarChart3 = wrapUniformIcon('BarChart3', LucideBarChart3);
export const Barcode = wrapUniformIcon('Barcode', LucideBarcode);
export const BookCheck = wrapUniformIcon('BookCheck', LucideBookCheck);
export const BookOpen = wrapUniformIcon('BookOpen', LucideBookOpen);
export const BookOpenCheck = wrapUniformIcon('BookOpenCheck', LucideBookOpenCheck);
export const BookPlus = wrapUniformIcon('BookPlus', LucideBookPlus);
export const Bookmark = wrapUniformIcon('Bookmark', LucideBookmark);
export const Brain = wrapUniformIcon('Brain', LucideBrain);
export const BrainCircuit = wrapUniformIcon('BrainCircuit', LucideBrainCircuit);
export const Briefcase = wrapUniformIcon('Briefcase', LucideBriefcase);
export const Building2 = wrapUniformIcon('Building2', LucideBuilding2);
export const Calculator = wrapUniformIcon('Calculator', LucideCalculator);
export const CalendarCheck = wrapUniformIcon('CalendarCheck', LucideCalendarCheck);
export const CalendarDays = wrapUniformIcon('CalendarDays', LucideCalendarDays);
export const CalendarRange = wrapUniformIcon('CalendarRange', LucideCalendarRange);
export const CheckSquare = wrapUniformIcon('CheckSquare', LucideCheckSquare);
export const ClipboardCheck = wrapUniformIcon('ClipboardCheck', LucideClipboardCheck);
export const ClipboardList = wrapUniformIcon('ClipboardList', LucideClipboardList);
export const ClipboardPlus = wrapUniformIcon('ClipboardPlus', LucideClipboardPlus);
export const Code2 = wrapUniformIcon('Code2', LucideCode2);
export const Compass = wrapUniformIcon('Compass', LucideCompass);
export const Cpu = wrapUniformIcon('Cpu', LucideCpu);
export const CreditCard = wrapUniformIcon('CreditCard', LucideCreditCard);
export const Database = wrapUniformIcon('Database', LucideDatabase);
export const DoorOpen = wrapUniformIcon('DoorOpen', LucideDoorOpen);
export const Feather = wrapUniformIcon('Feather', LucideFeather);
export const FileCheck = wrapUniformIcon('FileCheck', LucideFileCheck);
export const FileCode2 = wrapUniformIcon('FileCode2', LucideFileCode2);
export const FileDown = wrapUniformIcon('FileDown', LucideFileDown);
export const FileSpreadsheet = wrapUniformIcon('FileSpreadsheet', LucideFileSpreadsheet);
export const FileText = wrapUniformIcon('FileText', LucideFileText);
export const FlaskConical = wrapUniformIcon('FlaskConical', LucideFlaskConical);
export const FolderOpen = wrapUniformIcon('FolderOpen', LucideFolderOpen);
export const Gauge = wrapUniformIcon('Gauge', LucideGauge);
export const Globe = wrapUniformIcon('Globe', LucideGlobe);
export const GraduationCap = wrapUniformIcon('GraduationCap', LucideGraduationCap);
export const HeartHandshake = wrapUniformIcon('HeartHandshake', LucideHeartHandshake);
export const ImagePlus = wrapUniformIcon('ImagePlus', LucideImagePlus);
export const Landmark = wrapUniformIcon('Landmark', LucideLandmark);
export const Languages = wrapUniformIcon('Languages', LucideLanguages);
export const LifeBuoy = wrapUniformIcon('LifeBuoy', LucideLifeBuoy);
export const Lightbulb = wrapUniformIcon('Lightbulb', LucideLightbulb);
export const List = wrapUniformIcon('List', LucideList);
export const MessageSquareWarning = wrapUniformIcon('MessageSquareWarning', LucideMessageSquareWarning);
export const Monitor = wrapUniformIcon('Monitor', LucideMonitor);
export const PieChart = wrapUniformIcon('PieChart', LucidePieChart);
export const Pin = wrapUniformIcon('Pin', LucidePin);
export const ScanLine = wrapUniformIcon('ScanLine', LucideScanLine);
export const School = wrapUniformIcon('School', LucideSchool);
export const Square = wrapUniformIcon('Square', LucideSquare);
export const Thermometer = wrapUniformIcon('Thermometer', LucideThermometer);
export const TrendingDown = wrapUniformIcon('TrendingDown', LucideTrendingDown);
export const TrendingUp = wrapUniformIcon('TrendingUp', LucideTrendingUp);
export const Trophy = wrapUniformIcon('Trophy', LucideTrophy);
export const Tv = wrapUniformIcon('Tv', LucideTv);
export const Usb = wrapUniformIcon('Usb', LucideUsb);
export const UserCheck = wrapUniformIcon('UserCheck', LucideUserCheck);
export const Wifi = wrapUniformIcon('Wifi', LucideWifi);
export const WifiOff = wrapUniformIcon('WifiOff', LucideWifiOff);
export const Wind = wrapUniformIcon('Wind', LucideWind);
export const Wrench = wrapUniformIcon('Wrench', LucideWrench);
export const Zap = wrapUniformIcon('Zap', LucideZap);
