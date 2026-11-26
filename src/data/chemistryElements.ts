export type ElementCategory =
  | 'alkali_metal'
  | 'alkaline_earth'
  | 'transition_metal'
  | 'post_transition'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble_gas'
  | 'lanthanide'
  | 'actinide';

export interface ChemicalElement {
  z: number;
  symbol: string;
  nameVi: string;
  nameEn: string;
  mass: number;
  category: ElementCategory;
  group: number; // 1..18 (f-block uses 3)
  period: number; // 1..7
  gridRow: number; // 1..7 for main, 9 for Lanthanides, 10 for Actinides
  gridCol: number; // 1..18
  phase: 'Rắn' | 'Lỏng' | 'Khí';
  electronegativity: number | null;
  electronConfig: string;
  valenceHint: string;
}

export const ELEMENT_CATEGORY_META: Record<
  ElementCategory,
  { label: string; bgClass: string; badgeClass: string }
> = {
  alkali_metal: {
    label: 'Kim loại kiềm',
    bgClass: 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-400/50 text-rose-950 dark:text-rose-100',
    badgeClass: 'bg-rose-500/20 text-rose-700 dark:text-rose-300',
  },
  alkaline_earth: {
    label: 'Kiềm thổ',
    bgClass: 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/50 text-amber-950 dark:text-amber-100',
    badgeClass: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  },
  transition_metal: {
    label: 'Kim loại chuyển tiếp',
    bgClass: 'bg-sky-500/18 hover:bg-sky-500/28 border-sky-400/45 text-sky-950 dark:text-sky-100',
    badgeClass: 'bg-sky-500/20 text-sky-700 dark:text-sky-300',
  },
  post_transition: {
    label: 'Kim loại hậu chuyển tiếp',
    bgClass: 'bg-teal-500/18 hover:bg-teal-500/28 border-teal-400/45 text-teal-950 dark:text-teal-100',
    badgeClass: 'bg-teal-500/20 text-teal-700 dark:text-teal-300',
  },
  metalloid: {
    label: 'Á kim',
    bgClass: 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/50 text-emerald-950 dark:text-emerald-100',
    badgeClass: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  },
  nonmetal: {
    label: 'Phi kim',
    bgClass: 'bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-400/50 text-indigo-950 dark:text-indigo-100',
    badgeClass: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300',
  },
  halogen: {
    label: 'Halogen',
    bgClass: 'bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-400/50 text-cyan-950 dark:text-cyan-100',
    badgeClass: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300',
  },
  noble_gas: {
    label: 'Khí hiếm',
    bgClass: 'bg-violet-500/20 hover:bg-violet-500/30 border-violet-400/50 text-violet-950 dark:text-violet-100',
    badgeClass: 'bg-violet-500/20 text-violet-700 dark:text-violet-300',
  },
  lanthanide: {
    label: 'Họ Lantan',
    bgClass: 'bg-orange-500/18 hover:bg-orange-500/28 border-orange-400/45 text-orange-950 dark:text-orange-100',
    badgeClass: 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
  },
  actinide: {
    label: 'Họ Actini',
    bgClass: 'bg-pink-500/18 hover:bg-pink-500/28 border-pink-400/45 text-pink-950 dark:text-pink-100',
    badgeClass: 'bg-pink-500/20 text-pink-700 dark:text-pink-300',
  },
};

type RawTuple = [
  number, // z
  string, // symbol
  string, // nameVi
  string, // nameEn
  number, // mass
  ElementCategory,
  number, // group
  number, // period
  number, // gridRow
  number, // gridCol
  'Rắn' | 'Lỏng' | 'Khí',
  number | null, // electronegativity
  string, // electronConfig
  string // valenceHint
];

const RAW_ELEMENTS: RawTuple[] = [
  [1, 'H', 'Hiđro', 'Hydrogen', 1.008, 'nonmetal', 1, 1, 1, 1, 'Khí', 2.2, '1s1', 'I (+1, -1)'],
  [2, 'He', 'Heli', 'Helium', 4.0026, 'noble_gas', 18, 1, 1, 18, 'Khí', null, '1s2', '0 (Bền vững)'],
  [3, 'Li', 'Liti', 'Lithium', 6.94, 'alkali_metal', 1, 2, 2, 1, 'Rắn', 0.98, '[He] 2s1', 'I (+1)'],
  [4, 'Be', 'Beri', 'Beryllium', 9.0122, 'alkaline_earth', 2, 2, 2, 2, 'Rắn', 1.57, '[He] 2s2', 'II (+2)'],
  [5, 'B', 'Bo', 'Boron', 10.81, 'metalloid', 13, 2, 2, 13, 'Rắn', 2.04, '[He] 2s2 2p1', 'III (+3)'],
  [6, 'C', 'Cacbon', 'Carbon', 12.011, 'nonmetal', 14, 2, 2, 14, 'Rắn', 2.55, '[He] 2s2 2p2', 'IV, II (±4, +2)'],
  [7, 'N', 'Nitơ', 'Nitrogen', 14.007, 'nonmetal', 15, 2, 2, 15, 'Khí', 3.04, '[He] 2s2 2p3', 'III, V (-3..+5)'],
  [8, 'O', 'Oxi', 'Oxygen', 15.999, 'nonmetal', 16, 2, 2, 16, 'Khí', 3.44, '[He] 2s2 2p4', 'II (-2)'],
  [9, 'F', 'Flo', 'Fluorine', 18.998, 'halogen', 17, 2, 2, 17, 'Khí', 3.98, '[He] 2s2 2p5', 'I (-1)'],
  [10, 'Ne', 'Neon', 'Neon', 20.18, 'noble_gas', 18, 2, 2, 18, 'Khí', null, '[He] 2s2 2p6', '0 (Khí hiếm)'],
  [11, 'Na', 'Natri', 'Sodium', 22.99, 'alkali_metal', 1, 3, 3, 1, 'Rắn', 0.93, '[Ne] 3s1', 'I (+1)'],
  [12, 'Mg', 'Magiê', 'Magnesium', 24.305, 'alkaline_earth', 2, 3, 3, 2, 'Rắn', 1.31, '[Ne] 3s2', 'II (+2)'],
  [13, 'Al', 'Nhôm', 'Aluminum', 26.982, 'post_transition', 13, 3, 3, 13, 'Rắn', 1.61, '[Ne] 3s2 3p1', 'III (+3)'],
  [14, 'Si', 'Silic', 'Silicon', 28.085, 'metalloid', 14, 3, 3, 14, 'Rắn', 1.9, '[Ne] 3s2 3p2', 'IV (+4, -4)'],
  [15, 'P', 'Photpho', 'Phosphorus', 30.974, 'nonmetal', 15, 3, 3, 15, 'Rắn', 2.19, '[Ne] 3s2 3p3', 'III, V (-3, +3, +5)'],
  [16, 'S', 'Lưu huỳnh', 'Sulfur', 32.06, 'nonmetal', 16, 3, 3, 16, 'Rắn', 2.58, '[Ne] 3s2 3p4', 'II, IV, VI (-2, +4, +6)'],
  [17, 'Cl', 'Clo', 'Chlorine', 35.45, 'halogen', 17, 3, 3, 17, 'Khí', 3.16, '[Ne] 3s2 3p5', 'I, III, V, VII (-1..+7)'],
  [18, 'Ar', 'Argon', 'Argon', 39.948, 'noble_gas', 18, 3, 3, 18, 'Khí', null, '[Ne] 3s2 3p6', '0 (Khí hiếm)'],
  [19, 'K', 'Kali', 'Potassium', 39.098, 'alkali_metal', 1, 4, 4, 1, 'Rắn', 0.82, '[Ar] 4s1', 'I (+1)'],
  [20, 'Ca', 'Canxi', 'Calcium', 40.078, 'alkaline_earth', 2, 4, 4, 2, 'Rắn', 1.0, '[Ar] 4s2', 'II (+2)'],
  [21, 'Sc', 'Scandi', 'Scandium', 44.956, 'transition_metal', 3, 4, 4, 3, 'Rắn', 1.36, '[Ar] 3d1 4s2', 'III (+3)'],
  [22, 'Ti', 'Titan', 'Titanium', 47.867, 'transition_metal', 4, 4, 4, 4, 'Rắn', 1.54, '[Ar] 3d2 4s2', 'II, III, IV (+4)'],
  [23, 'V', 'Vanadi', 'Vanadium', 50.942, 'transition_metal', 5, 4, 4, 5, 'Rắn', 1.63, '[Ar] 3d3 4s2', 'II, III, IV, V'],
  [24, 'Cr', 'Crom', 'Chromium', 51.996, 'transition_metal', 6, 4, 4, 6, 'Rắn', 1.66, '[Ar] 3d5 4s1', 'II, III, VI (+3, +6)'],
  [25, 'Mn', 'Mangan', 'Manganese', 54.938, 'transition_metal', 7, 4, 4, 7, 'Rắn', 1.55, '[Ar] 3d5 4s2', 'II, IV, VII (+2, +4, +7)'],
  [26, 'Fe', 'Sắt', 'Iron', 55.845, 'transition_metal', 8, 4, 4, 8, 'Rắn', 1.83, '[Ar] 3d6 4s2', 'II, III (+2, +3)'],
  [27, 'Co', 'Coban', 'Cobalt', 58.933, 'transition_metal', 9, 4, 4, 9, 'Rắn', 1.88, '[Ar] 3d7 4s2', 'II, III (+2, +3)'],
  [28, 'Ni', 'Niken', 'Nickel', 58.693, 'transition_metal', 10, 4, 4, 10, 'Rắn', 1.91, '[Ar] 3d8 4s2', 'II (+2)'],
  [29, 'Cu', 'Đồng', 'Copper', 63.546, 'transition_metal', 11, 4, 4, 11, 'Rắn', 1.9, '[Ar] 3d10 4s1', 'I, II (+1, +2)'],
  [30, 'Zn', 'Kẽm', 'Zinc', 65.38, 'transition_metal', 12, 4, 4, 12, 'Rắn', 1.65, '[Ar] 3d10 4s2', 'II (+2)'],
  [31, 'Ga', 'Gali', 'Gallium', 69.723, 'post_transition', 13, 4, 4, 13, 'Rắn', 1.81, '[Ar] 3d10 4s2 4p1', 'III (+3)'],
  [32, 'Ge', 'Gecmani', 'Germanium', 72.63, 'metalloid', 14, 4, 4, 14, 'Rắn', 2.01, '[Ar] 3d10 4s2 4p2', 'IV (+4)'],
  [33, 'As', 'Asen', 'Arsenic', 74.922, 'metalloid', 15, 4, 4, 15, 'Rắn', 2.18, '[Ar] 3d10 4s2 4p3', 'III, V (-3, +3, +5)'],
  [34, 'Se', 'Selen', 'Selenium', 78.971, 'nonmetal', 16, 4, 4, 16, 'Rắn', 2.55, '[Ar] 3d10 4s2 4p4', 'II, IV, VI (-2..+6)'],
  [35, 'Br', 'Brom', 'Bromine', 79.904, 'halogen', 17, 4, 4, 17, 'Lỏng', 2.96, '[Ar] 3d10 4s2 4p5', 'I, V (-1, +1, +5)'],
  [36, 'Kr', 'Kripton', 'Krypton', 83.798, 'noble_gas', 18, 4, 4, 18, 'Khí', 3.0, '[Ar] 3d10 4s2 4p6', '0 (Khí hiếm)'],
  [37, 'Rb', 'Rubiđi', 'Rubidium', 85.468, 'alkali_metal', 1, 5, 5, 1, 'Rắn', 0.82, '[Kr] 5s1', 'I (+1)'],
  [38, 'Sr', 'Stronti', 'Strontium', 87.62, 'alkaline_earth', 2, 5, 5, 2, 'Rắn', 0.95, '[Kr] 5s2', 'II (+2)'],
  [39, 'Y', 'Ytri', 'Yttrium', 88.906, 'transition_metal', 3, 5, 5, 3, 'Rắn', 1.22, '[Kr] 4d1 5s2', 'III (+3)'],
  [40, 'Zr', 'Zirconi', 'Zirconium', 91.224, 'transition_metal', 4, 5, 5, 4, 'Rắn', 1.33, '[Kr] 4d2 5s2', 'IV (+4)'],
  [41, 'Nb', 'Niobi', 'Niobium', 92.906, 'transition_metal', 5, 5, 5, 5, 'Rắn', 1.6, '[Kr] 4d4 5s1', 'V (+5)'],
  [42, 'Mo', 'Molipđen', 'Molybdenum', 95.95, 'transition_metal', 6, 5, 5, 6, 'Rắn', 2.16, '[Kr] 4d5 5s1', 'VI (+4, +6)'],
  [43, 'Tc', 'Tecneti', 'Technetium', 98, 'transition_metal', 7, 5, 5, 7, 'Rắn', 1.9, '[Kr] 4d5 5s2', 'VII (+4, +7)'],
  [44, 'Ru', 'Ruteni', 'Ruthenium', 101.07, 'transition_metal', 8, 5, 5, 8, 'Rắn', 2.2, '[Kr] 4d7 5s1', 'III, IV, VIII'],
  [45, 'Rh', 'Rođi', 'Rhodium', 102.91, 'transition_metal', 9, 5, 5, 9, 'Rắn', 2.28, '[Kr] 4d8 5s1', 'III (+3)'],
  [46, 'Pd', 'Palađi', 'Palladium', 106.42, 'transition_metal', 10, 5, 5, 10, 'Rắn', 2.2, '[Kr] 4d10', 'II, IV (+2)'],
  [47, 'Ag', 'Bạc', 'Silver', 107.87, 'transition_metal', 11, 5, 5, 11, 'Rắn', 1.93, '[Kr] 4d10 5s1', 'I (+1)'],
  [48, 'Cd', 'Cađimi', 'Cadmium', 112.41, 'transition_metal', 12, 5, 5, 12, 'Rắn', 1.69, '[Kr] 4d10 5s2', 'II (+2)'],
  [49, 'In', 'Inđi', 'Indium', 114.82, 'post_transition', 13, 5, 5, 13, 'Rắn', 1.78, '[Kr] 4d10 5s2 5p1', 'III (+3)'],
  [50, 'Sn', 'Thiếc', 'Tin', 118.71, 'post_transition', 14, 5, 5, 14, 'Rắn', 1.96, '[Kr] 4d10 5s2 5p2', 'II, IV (+2, +4)'],
  [51, 'Sb', 'Antimon', 'Antimony', 121.76, 'metalloid', 15, 5, 5, 15, 'Rắn', 2.05, '[Kr] 4d10 5s2 5p3', 'III, V (+3, +5)'],
  [52, 'Te', 'Telu', 'Tellurium', 127.6, 'metalloid', 16, 5, 5, 16, 'Rắn', 2.1, '[Kr] 4d10 5s2 5p4', 'II, IV, VI'],
  [53, 'I', 'Iot', 'Iodine', 126.9, 'halogen', 17, 5, 5, 17, 'Rắn', 2.66, '[Kr] 4d10 5s2 5p5', 'I, V, VII (-1..+7)'],
  [54, 'Xe', 'Xenon', 'Xenon', 131.29, 'noble_gas', 18, 5, 5, 18, 'Khí', 2.6, '[Kr] 4d10 5s2 5p6', '0 (+2, +4, +6)'],
  [55, 'Cs', 'Xesi', 'Cesium', 132.91, 'alkali_metal', 1, 6, 6, 1, 'Rắn', 0.79, '[Xe] 6s1', 'I (+1)'],
  [56, 'Ba', 'Bari', 'Barium', 137.33, 'alkaline_earth', 2, 6, 6, 2, 'Rắn', 0.89, '[Xe] 6s2', 'II (+2)'],
  [57, 'La', 'Lantan', 'Lanthanum', 138.91, 'lanthanide', 3, 6, 9, 3, 'Rắn', 1.1, '[Xe] 5d1 6s2', 'III (+3)'],
  [58, 'Ce', 'Xeri', 'Cerium', 140.12, 'lanthanide', 3, 6, 9, 4, 'Rắn', 1.12, '[Xe] 4f1 5d1 6s2', 'III, IV'],
  [59, 'Pr', 'Prazeođim', 'Praseodymium', 140.91, 'lanthanide', 3, 6, 9, 5, 'Rắn', 1.13, '[Xe] 4f3 6s2', 'III (+3)'],
  [60, 'Nd', 'Neođim', 'Neodymium', 144.24, 'lanthanide', 3, 6, 9, 6, 'Rắn', 1.14, '[Xe] 4f4 6s2', 'III (+3)'],
  [61, 'Pm', 'Prometi', 'Promethium', 145, 'lanthanide', 3, 6, 9, 7, 'Rắn', 1.13, '[Xe] 4f5 6s2', 'III (+3)'],
  [62, 'Sm', 'Samari', 'Samarium', 150.36, 'lanthanide', 3, 6, 9, 8, 'Rắn', 1.17, '[Xe] 4f6 6s2', 'III (+3)'],
  [63, 'Eu', 'Europi', 'Europium', 151.96, 'lanthanide', 3, 6, 9, 9, 'Rắn', 1.2, '[Xe] 4f7 6s2', 'II, III'],
  [64, 'Gd', 'Gađolini', 'Gadolinium', 157.25, 'lanthanide', 3, 6, 9, 10, 'Rắn', 1.2, '[Xe] 4f7 5d1 6s2', 'III (+3)'],
  [65, 'Tb', 'Tecbi', 'Terbium', 158.93, 'lanthanide', 3, 6, 9, 11, 'Rắn', 1.2, '[Xe] 4f9 6s2', 'III (+3)'],
  [66, 'Dy', 'Điprozi', 'Dysprosium', 162.5, 'lanthanide', 3, 6, 9, 12, 'Rắn', 1.22, '[Xe] 4f10 6s2', 'III (+3)'],
  [67, 'Ho', 'Honmi', 'Holmium', 164.93, 'lanthanide', 3, 6, 9, 13, 'Rắn', 1.23, '[Xe] 4f11 6s2', 'III (+3)'],
  [68, 'Er', 'Eribi', 'Erbium', 167.26, 'lanthanide', 3, 6, 9, 14, 'Rắn', 1.24, '[Xe] 4f12 6s2', 'III (+3)'],
  [69, 'Tm', 'Tuli', 'Thulium', 168.93, 'lanthanide', 3, 6, 9, 15, 'Rắn', 1.25, '[Xe] 4f13 6s2', 'III (+3)'],
  [70, 'Yb', 'Ytecbi', 'Ytterbium', 173.05, 'lanthanide', 3, 6, 9, 16, 'Rắn', 1.1, '[Xe] 4f14 6s2', 'III (+3)'],
  [71, 'Lu', 'Lutexi', 'Lutetium', 174.97, 'lanthanide', 3, 6, 9, 17, 'Rắn', 1.27, '[Xe] 4f14 5d1 6s2', 'III (+3)'],
  [72, 'Hf', 'Hafini', 'Hafnium', 178.49, 'transition_metal', 4, 6, 6, 4, 'Rắn', 1.3, '[Xe] 4f14 5d2 6s2', 'IV (+4)'],
  [73, 'Ta', 'Tantan', 'Tantalum', 180.95, 'transition_metal', 5, 6, 6, 5, 'Rắn', 1.5, '[Xe] 4f14 5d3 6s2', 'V (+5)'],
  [74, 'W', 'Vonfram', 'Tungsten', 183.84, 'transition_metal', 6, 6, 6, 6, 'Rắn', 2.36, '[Xe] 4f14 5d4 6s2', 'VI (+4, +6)'],
  [75, 'Re', 'Reni', 'Rhenium', 186.21, 'transition_metal', 7, 6, 6, 7, 'Rắn', 1.9, '[Xe] 4f14 5d5 6s2', 'IV, VII'],
  [76, 'Os', 'Osimi', 'Osmium', 190.23, 'transition_metal', 8, 6, 6, 8, 'Rắn', 2.2, '[Xe] 4f14 5d6 6s2', 'IV, VIII'],
  [77, 'Ir', 'Iriđi', 'Iridium', 192.22, 'transition_metal', 9, 6, 6, 9, 'Rắn', 2.2, '[Xe] 4f14 5d7 6s2', 'III, IV'],
  [78, 'Pt', 'Platin', 'Platinum', 195.08, 'transition_metal', 10, 6, 6, 10, 'Rắn', 2.28, '[Xe] 4f14 5d9 6s1', 'II, IV'],
  [79, 'Au', 'Vàng', 'Gold', 196.97, 'transition_metal', 11, 6, 6, 11, 'Rắn', 2.54, '[Xe] 4f14 5d10 6s1', 'I, III'],
  [80, 'Hg', 'Thủy ngân', 'Mercury', 200.59, 'transition_metal', 12, 6, 6, 12, 'Lỏng', 2.0, '[Xe] 4f14 5d10 6s2', 'I, II'],
  [81, 'Tl', 'Tali', 'Thallium', 204.38, 'post_transition', 13, 6, 6, 13, 'Rắn', 1.62, '[Xe] 4f14 5d10 6s2 6p1', 'I, III'],
  [82, 'Pb', 'Chì', 'Lead', 207.2, 'post_transition', 14, 6, 6, 14, 'Rắn', 2.33, '[Xe] 4f14 5d10 6s2 6p2', 'II, IV'],
  [83, 'Bi', 'Bitmut', 'Bismuth', 208.98, 'post_transition', 15, 6, 6, 15, 'Rắn', 2.02, '[Xe] 4f14 5d10 6s2 6p3', 'III, V'],
  [84, 'Po', 'Poloni', 'Polonium', 209, 'post_transition', 16, 6, 6, 16, 'Rắn', 2.0, '[Xe] 4f14 5d10 6s2 6p4', 'II, IV'],
  [85, 'At', 'Atatin', 'Astatine', 210, 'metalloid', 17, 6, 6, 17, 'Rắn', 2.2, '[Xe] 4f14 5d10 6s2 6p5', 'I (-1, +1)'],
  [86, 'Rn', 'Rađon', 'Radon', 222, 'noble_gas', 18, 6, 6, 18, 'Khí', 2.2, '[Xe] 4f14 5d10 6s2 6p6', '0 (Phóng xạ)'],
  [87, 'Fr', 'Franxi', 'Francium', 223, 'alkali_metal', 1, 7, 7, 1, 'Rắn', 0.7, '[Rn] 7s1', 'I (+1)'],
  [88, 'Ra', 'Rađi', 'Radium', 226, 'alkaline_earth', 2, 7, 7, 2, 'Rắn', 0.9, '[Rn] 7s2', 'II (+2)'],
  [89, 'Ac', 'Actini', 'Actinium', 227, 'actinide', 3, 7, 10, 3, 'Rắn', 1.1, '[Rn] 6d1 7s2', 'III (+3)'],
  [90, 'Th', 'Thori', 'Thorium', 232.04, 'actinide', 3, 7, 10, 4, 'Rắn', 1.3, '[Rn] 6d2 7s2', 'IV (+4)'],
  [91, 'Pa', 'Protactini', 'Protactinium', 231.04, 'actinide', 3, 7, 10, 5, 'Rắn', 1.5, '[Rn] 5f2 6d1 7s2', 'V (+5)'],
  [92, 'U', 'Urani', 'Uranium', 238.03, 'actinide', 3, 7, 10, 6, 'Rắn', 1.38, '[Rn] 5f3 6d1 7s2', 'IV, VI'],
  [93, 'Np', 'Neptuni', 'Neptunium', 237, 'actinide', 3, 7, 10, 7, 'Rắn', 1.36, '[Rn] 5f4 6d1 7s2', 'III..VII'],
  [94, 'Pu', 'Plutoni', 'Plutonium', 244, 'actinide', 3, 7, 10, 8, 'Rắn', 1.28, '[Rn] 5f6 7s2', 'IV (+4)'],
  [95, 'Am', 'Amerixi', 'Americium', 243, 'actinide', 3, 7, 10, 9, 'Rắn', 1.3, '[Rn] 5f7 7s2', 'III (+3)'],
  [96, 'Cm', 'Curi', 'Curium', 247, 'actinide', 3, 7, 10, 10, 'Rắn', 1.3, '[Rn] 5f7 6d1 7s2', 'III (+3)'],
  [97, 'Bk', 'Beckeli', 'Berkelium', 247, 'actinide', 3, 7, 10, 11, 'Rắn', 1.3, '[Rn] 5f9 7s2', 'III (+3)'],
  [98, 'Cf', 'Califoni', 'Californium', 251, 'actinide', 3, 7, 10, 12, 'Rắn', 1.3, '[Rn] 5f10 7s2', 'III (+3)'],
  [99, 'Es', 'Ensteini', 'Einsteinium', 252, 'actinide', 3, 7, 10, 13, 'Rắn', 1.3, '[Rn] 5f11 7s2', 'III (+3)'],
  [100, 'Fm', 'Fecmi', 'Fermium', 257, 'actinide', 3, 7, 10, 14, 'Rắn', 1.3, '[Rn] 5f12 7s2', 'III (+3)'],
  [101, 'Md', 'Menđelevi', 'Mendelevium', 258, 'actinide', 3, 7, 10, 15, 'Rắn', 1.3, '[Rn] 5f13 7s2', 'III (+3)'],
  [102, 'No', 'Nobeli', 'Nobelium', 259, 'actinide', 3, 7, 10, 16, 'Rắn', 1.3, '[Rn] 5f14 7s2', 'II, III'],
  [103, 'Lr', 'Lorenxi', 'Lawrencium', 266, 'actinide', 3, 7, 10, 17, 'Rắn', 1.3, '[Rn] 5f14 7s2 7p1', 'III (+3)'],
  [104, 'Rf', 'Rơzơfođi', 'Rutherfordium', 267, 'transition_metal', 4, 7, 7, 4, 'Rắn', null, '[Rn] 5f14 6d2 7s2', 'IV (+4)'],
  [105, 'Db', 'Đupni', 'Dubnium', 268, 'transition_metal', 5, 7, 7, 5, 'Rắn', null, '[Rn] 5f14 6d3 7s2', 'V (+5)'],
  [106, 'Sg', 'Sibogi', 'Seaborgium', 269, 'transition_metal', 6, 7, 7, 6, 'Rắn', null, '[Rn] 5f14 6d4 7s2', 'VI (+6)'],
  [107, 'Bh', 'Bori', 'Bohrium', 270, 'transition_metal', 7, 7, 7, 7, 'Rắn', null, '[Rn] 5f14 6d5 7s2', 'VII (+7)'],
  [108, 'Hs', 'Hasi', 'Hassium', 277, 'transition_metal', 8, 7, 7, 8, 'Rắn', null, '[Rn] 5f14 6d6 7s2', 'VIII (+8)'],
  [109, 'Mt', 'Meitneri', 'Meitnerium', 278, 'transition_metal', 9, 7, 7, 9, 'Rắn', null, '[Rn] 5f14 6d7 7s2', 'Tổng hợp'],
  [110, 'Ds', 'Đamstati', 'Darmstadtium', 281, 'transition_metal', 10, 7, 7, 10, 'Rắn', null, '[Rn] 5f14 6d8 7s2', 'Tổng hợp'],
  [111, 'Rg', 'Rơngheni', 'Roentgenium', 282, 'transition_metal', 11, 7, 7, 11, 'Rắn', null, '[Rn] 5f14 6d9 7s2', 'Tổng hợp'],
  [112, 'Cn', 'Copernixi', 'Copernicium', 285, 'transition_metal', 12, 7, 7, 12, 'Lỏng', null, '[Rn] 5f14 6d10 7s2', 'Tổng hợp'],
  [113, 'Nh', 'Nihoni', 'Nihonium', 286, 'post_transition', 13, 7, 7, 13, 'Rắn', null, '[Rn] 5f14 6d10 7s2 7p1', 'Tổng hợp'],
  [114, 'Fl', 'Flerovi', 'Flerovium', 289, 'post_transition', 14, 7, 7, 14, 'Rắn', null, '[Rn] 5f14 6d10 7s2 7p2', 'Tổng hợp'],
  [115, 'Mc', 'Moscovi', 'Moscovium', 290, 'post_transition', 15, 7, 7, 15, 'Rắn', null, '[Rn] 5f14 6d10 7s2 7p3', 'Tổng hợp'],
  [116, 'Lv', 'Livermori', 'Livermorium', 293, 'post_transition', 16, 7, 7, 16, 'Rắn', null, '[Rn] 5f14 6d10 7s2 7p4', 'Tổng hợp'],
  [117, 'Ts', 'Tennessine', 'Tennessine', 294, 'halogen', 17, 7, 7, 17, 'Rắn', null, '[Rn] 5f14 6d10 7s2 7p5', 'Tổng hợp'],
  [118, 'Og', 'Oganesson', 'Oganesson', 294, 'noble_gas', 18, 7, 7, 18, 'Khí', null, '[Rn] 5f14 6d10 7s2 7p6', '0 (Khí hiếm)'],
];

export const PERIODIC_ELEMENTS: ChemicalElement[] = RAW_ELEMENTS.map((item) => ({
  z: item[0],
  symbol: item[1],
  nameVi: item[2],
  nameEn: item[3],
  mass: item[4],
  category: item[5],
  group: item[6],
  period: item[7],
  gridRow: item[8],
  gridCol: item[9],
  phase: item[10],
  electronegativity: item[11],
  electronConfig: item[12],
  valenceHint: item[13],
}));

export const ELEMENT_BY_SYMBOL: Record<string, ChemicalElement> = Object.fromEntries(
  PERIODIC_ELEMENTS.map((el) => [el.symbol, el])
);
