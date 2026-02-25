// ========== 种子随机系统 ==========

function fnv1aHash(str: string): number {
  const bytes = new TextEncoder().encode(str);
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng: () => number, count: number): number {
  return Math.floor(rng() * count);
}

// ========== 类型定义 ==========

export interface CatTraits {
  headType: number;
  bodyType: number;
  earType: number;
  eyeType: number;
  mouthType: number;
  tailType: number;
  paletteIndex: number;
  patternType: number;
}

interface Palette {
  name: string;
  base: string;
  dark: string;
  light: string;
  nose: string;
  accent: string;
}

// ========== 色板 ==========

const PALETTES: Palette[] = [
  { name: '奶油', base: '#F5E6D3', dark: '#C4A882', light: '#FFF8F0', nose: '#FFB6C1', accent: '#E8D5B7' },
  { name: '橘猫', base: '#F4A460', dark: '#CD853F', light: '#FFDAB9', nose: '#FF8C69', accent: '#FF7F50' },
  { name: '蓝灰', base: '#A8B4C0', dark: '#6B7B8D', light: '#D0D8E0', nose: '#B0A0A8', accent: '#8899AA' },
  { name: '炭黑', base: '#4A4A4A', dark: '#2A2A2A', light: '#808080', nose: '#3A3A3A', accent: '#5A5A5A' },
  { name: '浅棕', base: '#C4A882', dark: '#8B7355', light: '#E8D5B7', nose: '#D4A0A0', accent: '#A08060' },
];

// ========== SVG 部件函数 ==========

function renderTail(tailType: number, p: Palette): string {
  const strk = `stroke="${p.dark}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="${p.base}"`;
  switch (tailType) {
    case 0: // 问号尾
      return `<g><path d="M280,300 Q330,280 320,240 Q310,200 330,180 Q350,160 340,140" ${strk}/></g>`;
    case 1: // 盘绕尾
      return `<g><path d="M280,310 Q340,310 350,280 Q360,250 330,240 Q300,230 310,260" ${strk}/></g>`;
    default: // 炸毛尾
      return `<g><path d="M280,300 Q320,270 310,240 L325,235 Q315,220 330,210 L320,200 Q335,190 325,175" ${strk}/></g>`;
  }
}

function renderBody(bodyType: number, p: Palette): string {
  let bodyPath: string;
  switch (bodyType) {
    case 0: // 梨形
      bodyPath = 'M140,240 Q130,280 140,330 Q160,370 200,375 Q240,370 260,330 Q270,280 260,240 Q230,220 200,220 Q170,220 140,240Z';
      break;
    case 1: // 豆子
      bodyPath = 'M145,235 Q125,280 145,340 Q165,375 200,380 Q235,375 255,340 Q275,280 255,235 Q230,215 200,215 Q170,215 145,235Z';
      break;
    default: // 长条
      bodyPath = 'M155,230 Q140,270 145,340 Q155,380 200,385 Q245,380 255,340 Q260,270 245,230 Q225,215 200,215 Q175,215 155,230Z';
  }
  return `<g>
    <defs><clipPath id="body-clip"><path d="${bodyPath}"/></clipPath></defs>
    <path d="${bodyPath}" fill="${p.base}" stroke="${p.dark}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${bodyPath.replace(/Z$/, '')}" fill="${p.light}" opacity="0.4" transform="translate(0,30) scale(0.85)" transform-origin="200 300"/>
  </g>`;
}

function renderBodyPattern(bodyType: number, patternType: number, p: Palette): string {
  if (patternType === 0) return '';
  let inner = '';
  switch (patternType) {
    case 1: // 燕尾服 - 白色胸腹
      inner = `<path d="M170,270 Q180,310 200,330 Q220,310 230,270 Q215,255 200,255 Q185,255 170,270Z" fill="#FFFFFF" opacity="0.85"/>`;
      break;
    case 2: // 虎斑
      inner = `<g stroke="${p.dark}" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.5">
        <path d="M165,260 Q185,255 195,265"/>
        <path d="M205,265 Q215,255 235,260"/>
        <path d="M160,290 Q180,285 200,290"/>
        <path d="M200,290 Q220,285 240,290"/>
      </g>`;
      break;
    case 3: // 暹罗 - 四肢深色
      inner = `<g fill="${p.dark}" opacity="0.5">
        <path d="M150,330 Q160,370 175,375 Q185,370 180,330Z"/>
        <path d="M250,330 Q240,370 225,375 Q215,370 220,330Z"/>
      </g>`;
      break;
    default: // 三花
      inner = `<g opacity="0.6">
        <path d="M160,260 Q170,240 190,255 Q180,275 160,260Z" fill="${p.accent}"/>
        <path d="M220,280 Q240,270 245,290 Q230,300 220,280Z" fill="#F4A460"/>
      </g>`;
  }
  return `<g clip-path="url(#body-clip)">${inner}</g>`;
}

function renderFrontLegs(bodyType: number, p: Palette): string {
  const y = bodyType === 2 ? 345 : 335;
  return `<g>
    <path d="M170,${y} Q165,370 168,390 Q175,395 185,390 Q188,370 185,${y}" fill="${p.base}" stroke="${p.dark}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M215,${y} Q212,370 215,390 Q222,395 232,390 Q235,370 230,${y}" fill="${p.base}" stroke="${p.dark}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M166,388 Q175,395 187,388" fill="${p.light}" stroke="${p.dark}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M213,388 Q222,395 234,388" fill="${p.light}" stroke="${p.dark}" stroke-width="1.5" stroke-linecap="round"/>
  </g>`;
}

function renderHead(headType: number, p: Palette): string {
  let headPath: string;
  switch (headType) {
    case 0: // 包子脸
      headPath = 'M120,150 Q120,90 200,85 Q280,90 280,150 Q280,210 200,220 Q120,210 120,150Z';
      break;
    case 1: // 标准
      headPath = 'M125,150 Q125,95 200,88 Q275,95 275,150 Q275,205 200,215 Q125,205 125,150Z';
      break;
    default: // 扁脸
      headPath = 'M115,155 Q115,105 200,100 Q285,105 285,155 Q285,200 200,210 Q115,200 115,155Z';
  }
  return `<g>
    <defs><clipPath id="head-clip"><path d="${headPath}"/></clipPath></defs>
    <path d="${headPath}" fill="${p.base}" stroke="${p.dark}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

function renderEars(headType: number, earType: number, p: Palette): string {
  const topY = headType === 2 ? 105 : 90;
  let leftEar: string, rightEar: string;
  switch (earType) {
    case 0: // 竖耳
      leftEar = `M140,${topY} L125,${topY - 50} L165,${topY - 10}Z`;
      rightEar = `M260,${topY} L275,${topY - 50} L235,${topY - 10}Z`;
      break;
    case 1: // 折耳
      leftEar = `M135,${topY} L120,${topY - 35} Q135,${topY - 20} 160,${topY - 5}Z`;
      rightEar = `M265,${topY} L280,${topY - 35} Q265,${topY - 20} 240,${topY - 5}Z`;
      break;
    default: // 飞机耳
      leftEar = `M140,${topY} L105,${topY - 35} L165,${topY - 5}Z`;
      rightEar = `M260,${topY} L295,${topY - 35} L235,${topY - 5}Z`;
  }
  return `<g>
    <path d="${leftEar}" fill="${p.base}" stroke="${p.dark}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${rightEar}" fill="${p.base}" stroke="${p.dark}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${leftEar}" fill="${p.dark}" opacity="0.3" transform="scale(0.6)" transform-origin="140 ${topY - 20}"/>
    <path d="${rightEar}" fill="${p.dark}" opacity="0.3" transform="scale(0.6)" transform-origin="260 ${topY - 20}"/>
  </g>`;
}

function renderHeadPattern(headType: number, patternType: number, p: Palette): string {
  if (patternType === 0) return '';
  let inner = '';
  switch (patternType) {
    case 1: // 燕尾服
      inner = `<path d="M175,170 Q190,185 200,185 Q210,185 225,170 Q215,195 200,200 Q185,195 175,170Z" fill="#FFFFFF" opacity="0.8"/>`;
      break;
    case 2: // 虎斑
      inner = `<g stroke="${p.dark}" stroke-width="3.5" fill="none" stroke-linecap="round" opacity="0.45">
        <path d="M160,120 Q175,115 190,125"/>
        <path d="M210,125 Q225,115 240,120"/>
        <path d="M185,105 Q200,98 215,105"/>
      </g>`;
      break;
    case 3: // 暹罗
      inner = `<path d="M165,145 Q180,130 200,128 Q220,130 235,145 Q225,165 200,170 Q175,165 165,145Z" fill="${p.dark}" opacity="0.4"/>`;
      break;
    default: // 三花
      inner = `<g opacity="0.55">
        <path d="M150,130 Q165,115 175,135 Q160,145 150,130Z" fill="${p.accent}"/>
        <path d="M230,125 Q245,120 240,140 Q225,140 230,125Z" fill="#F4A460"/>
      </g>`;
  }
  return `<g clip-path="url(#head-clip)">${inner}</g>`;
}

function renderFace(headType: number, eyeType: number, mouthType: number, p: Palette): string {
  const cy = headType === 2 ? 152 : 148;
  // 眼睛
  let eyes: string;
  switch (eyeType) {
    case 0: // 好奇 - 大圆眼
      eyes = `
        <path d="M163,${cy - 8} Q163,${cy - 18} 173,${cy - 18} Q183,${cy - 18} 183,${cy - 8} Q183,${cy + 2} 173,${cy + 2} Q163,${cy + 2} 163,${cy - 8}Z" fill="#2D2D2D"/>
        <path d="M217,${cy - 8} Q217,${cy - 18} 227,${cy - 18} Q237,${cy - 18} 237,${cy - 8} Q237,${cy + 2} 227,${cy + 2} Q217,${cy + 2} 217,${cy - 8}Z" fill="#2D2D2D"/>
        <path d="M168,${cy - 13} Q170,${cy - 16} 174,${cy - 15}" fill="#FFF" stroke="none"/>
        <path d="M222,${cy - 13} Q224,${cy - 16} 228,${cy - 15}" fill="#FFF" stroke="none"/>`;
      break;
    case 1: // 慵懒 - 半闭眼
      eyes = `
        <path d="M160,${cy - 5} Q173,${cy - 15} 186,${cy - 5}" fill="none" stroke="#2D2D2D" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M214,${cy - 5} Q227,${cy - 15} 240,${cy - 5}" fill="none" stroke="#2D2D2D" stroke-width="3.5" stroke-linecap="round"/>`;
      break;
    default: // 愉悦 - 弯弯眼
      eyes = `
        <path d="M160,${cy - 8} Q173,${cy - 20} 186,${cy - 8}" fill="none" stroke="#2D2D2D" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M214,${cy - 8} Q227,${cy - 20} 240,${cy - 8}" fill="none" stroke="#2D2D2D" stroke-width="3.5" stroke-linecap="round"/>`;
  }

  // 鼻子
  const nose = `<path d="M195,${cy + 10} L200,${cy + 16} L205,${cy + 10}Z" fill="${p.nose}"/>`;

  // 嘴
  let mouth: string;
  switch (mouthType) {
    case 0: // ω嘴
      mouth = `<path d="M188,${cy + 20} Q194,${cy + 28} 200,${cy + 22} Q206,${cy + 28} 212,${cy + 20}" fill="none" stroke="#2D2D2D" stroke-width="2" stroke-linecap="round"/>`;
      break;
    case 1: // 虎牙
      mouth = `<path d="M188,${cy + 20} Q200,${cy + 28} 212,${cy + 20}" fill="none" stroke="#2D2D2D" stroke-width="2" stroke-linecap="round"/>
        <path d="M195,${cy + 22} L193,${cy + 28}" stroke="#FFF" stroke-width="2" stroke-linecap="round"/>`;
      break;
    default: // 倒V
      mouth = `<path d="M192,${cy + 22} L200,${cy + 18} L208,${cy + 22}" fill="none" stroke="#2D2D2D" stroke-width="2" stroke-linecap="round"/>`;
  }

  // 胡须
  const whiskers = `<g stroke="${p.dark}" stroke-width="1.5" stroke-linecap="round" opacity="0.5">
    <path d="M155,${cy + 12} L120,${cy + 5}"/>
    <path d="M155,${cy + 18} L118,${cy + 22}"/>
    <path d="M245,${cy + 12} L280,${cy + 5}"/>
    <path d="M245,${cy + 18} L282,${cy + 22}"/>
  </g>`;

  // 吻部
  const muzzle = `<path d="M178,${cy + 5} Q190,${cy + 2} 200,${cy + 5} Q210,${cy + 2} 222,${cy + 5} Q222,${cy + 18} 200,${cy + 22} Q178,${cy + 18} 178,${cy + 5}Z" fill="${p.light}" opacity="0.6"/>`;

  return `<g>${muzzle}${eyes}${nose}${mouth}${whiskers}</g>`;
}

// ========== 主类 ==========

export class CatService {
  generateCat(userId: string): { svg: string; traits: CatTraits } {
    const seed = fnv1aHash(userId);
    const rng = mulberry32(seed);

    // 固定消费顺序
    const traits: CatTraits = {
      headType: pick(rng, 3),
      bodyType: pick(rng, 3),
      earType: pick(rng, 3),
      eyeType: pick(rng, 3),
      mouthType: pick(rng, 3),
      tailType: pick(rng, 3),
      paletteIndex: pick(rng, 5),
      patternType: pick(rng, 5),
    };

    const palette = PALETTES[traits.paletteIndex];

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
      ${renderTail(traits.tailType, palette)}
      ${renderBody(traits.bodyType, palette)}
      ${renderBodyPattern(traits.bodyType, traits.patternType, palette)}
      ${renderFrontLegs(traits.bodyType, palette)}
      ${renderHead(traits.headType, palette)}
      ${renderEars(traits.headType, traits.earType, palette)}
      ${renderHeadPattern(traits.headType, traits.patternType, palette)}
      ${renderFace(traits.headType, traits.eyeType, traits.mouthType, palette)}
    </svg>`;

    return { svg, traits };
  }

  getPaletteName(index: number): string {
    return PALETTES[index]?.name ?? '未知';
  }

  static readonly PATTERN_NAMES = ['纯色', '燕尾服', '虎斑', '暹罗', '三花'];
  static readonly HEAD_NAMES = ['包子脸', '标准脸', '扁脸'];
  static readonly BODY_NAMES = ['梨形', '豆子', '长条'];
  static readonly EAR_NAMES = ['竖耳', '折耳', '飞机耳'];
  static readonly EYE_NAMES = ['好奇眼', '慵懒眼', '弯弯眼'];
  static readonly MOUTH_NAMES = ['ω嘴', '虎牙', '倒V嘴'];
  static readonly TAIL_NAMES = ['问号尾', '盘绕尾', '炸毛尾'];
}
