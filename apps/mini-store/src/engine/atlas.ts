// Texture atlas: every sign, sticker, poster and product label is drawn with Canvas 2D.
import { CK_ORG, CK_RED, GRAB, PACK, XSM } from './constants';
import { pick, rnd, seed } from './math';

/** [u0, v0, u1, v1] with v growing downwards (canvas space, uploaded without flip) */
export type UV = [number, number, number, number];
type Ctx = CanvasRenderingContext2D;
type Draw = (c: Ctx, w: number, h: number) => void;

const ASW = 2048,
  ASH = 4096;
const FONT = '"Helvetica Neue","Arial","Segoe UI",Roboto,sans-serif';
/** atlas rectangles by name, filled by buildAtlas() */
export const R: Record<string, UV> = {};

let canvas: HTMLCanvasElement | null = null;
let AX: Ctx;
let packX = 2,
  packY = 2,
  packH = 0;

function alloc(name: string, w: number, h: number, fn: Draw): void {
  if (packX + w + 2 > ASW) {
    packX = 2;
    packY += packH + 4;
    packH = 0;
  }
  const x = packX,
    y = packY;
  packX += w + 4;
  packH = Math.max(packH, h);
  if (y + h > ASH) console.warn('atlas full', name);
  AX.save();
  AX.translate(x, y);
  AX.beginPath();
  AX.rect(0, 0, w, h);
  AX.clip();
  fn(AX, w, h);
  AX.restore();
  R[name] = [(x + 0.5) / ASW, (y + 0.5) / ASH, (x + w - 0.5) / ASW, (y + h - 0.5) / ASH];
}

// ---- drawing helpers ----
function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function txt(
  c: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  col: string,
  wt = 800,
  al: CanvasTextAlign = 'center',
) {
  c.font = wt + ' ' + size + 'px ' + FONT;
  c.fillStyle = col;
  c.textAlign = al;
  c.textBaseline = 'middle';
  c.fillText(s, x, y);
}
function fitTxt(
  c: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  maxW: number,
  col: string,
  wt = 800,
) {
  c.font = wt + ' ' + size + 'px ' + FONT;
  const w = c.measureText(s).width;
  if (w > maxW) size *= maxW / w;
  txt(c, s, x, y, size, col, wt);
}
function shade(h: string, p: number) {
  const n = parseInt(h.slice(1), 16),
    k = (v: number) => Math.max(0, Math.min(255, v));
  return 'rgb(' + k((n >> 16) + p) + ',' + k(((n >> 8) & 255) + p) + ',' + k((n & 255) + p) + ')';
}
/** white disc + red K — the round Circle K mark */
function ckLogo(c: Ctx, cx: number, cy: number, r: number, bg = '#fff', k = CK_RED) {
  c.fillStyle = bg;
  c.beginPath();
  c.arc(cx, cy, r, 0, 7);
  c.fill();
  const s = r * 0.78;
  c.fillStyle = k;
  c.fillRect(cx - s * 0.5, cy - s * 0.6, s * 0.26, s * 1.2);
  c.beginPath();
  c.moveTo(cx - s * 0.2, cy + s * 0.02);
  c.lineTo(cx + s * 0.34, cy - s * 0.6);
  c.lineTo(cx + s * 0.68, cy - s * 0.6);
  c.lineTo(cx + s * 0.04, cy + s * 0.08);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(cx - s * 0.06, cy - s * 0.1);
  c.lineTo(cx + s * 0.7, cy + s * 0.6);
  c.lineTo(cx + s * 0.34, cy + s * 0.6);
  c.lineTo(cx - s * 0.24, cy + s * 0.08);
  c.closePath();
  c.fill();
}
function redPanel(c: Ctx, w: number, h: number) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#f2352b');
  g.addColorStop(1, '#d91a14');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.fillStyle = CK_ORG;
  c.fillRect(0, h * 0.8, w, h * 0.1);
  c.fillStyle = '#fff';
  c.fillRect(0, h * 0.9, w, h * 0.1);
}
interface ProductOpts {
  bg?: string;
  back?: string;
  small?: boolean;
  bottles?: boolean;
  pal?: readonly string[];
}
function products(c: Ctx, w: number, h: number, rows: number, o: ProductOpts = {}) {
  const rh = h / rows;
  c.fillStyle = o.bg || '#ece9e2';
  c.fillRect(0, 0, w, h);
  for (let r = 0; r < rows; r++) {
    const y0 = r * rh;
    c.fillStyle = o.back || '#d9d5cc';
    c.fillRect(0, y0, w, rh);
    let x = 2;
    while (x < w - 4) {
      const iw = (o.small ? 7 : 10) + rnd() * (o.small ? 10 : 22),
        ih = rh * (0.42 + rnd() * 0.42),
        col = pick(o.pal || PACK),
        n = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < n && x < w - 4; k++) {
        const yy = y0 + rh - 8 - ih,
          g = c.createLinearGradient(x, 0, x + iw, 0);
        g.addColorStop(0, shade(col, -20));
        g.addColorStop(0.45, shade(col, 25));
        g.addColorStop(1, shade(col, -35));
        c.fillStyle = g;
        if (o.bottles && rnd() < 0.75) {
          rr(c, x + 1, yy, iw - 2, ih, iw * 0.3);
          c.fill();
          c.fillStyle = shade(col, -50);
          c.fillRect(x + iw * 0.3, yy - 5, iw * 0.4, 6);
          c.fillStyle = 'rgba(255,255,255,.85)';
          c.fillRect(x + 2, yy + ih * 0.35, iw - 4, ih * 0.28);
          c.fillStyle = pick(PACK);
          c.fillRect(x + 3, yy + ih * 0.42, iw - 6, ih * 0.07);
        } else {
          c.fillRect(x, yy, iw - 1.5, ih);
          c.fillStyle = 'rgba(255,255,255,' + (0.45 + rnd() * 0.5) + ')';
          c.fillRect(x + 2, yy + ih * (0.18 + rnd() * 0.3), iw - 5, ih * 0.16);
          c.fillStyle = pick(PACK);
          c.fillRect(x + 2, yy + ih * 0.62, iw - 5, ih * 0.1);
        }
        x += iw;
      }
      x += 1 + rnd() * 3;
    }
    c.fillStyle = '#f4f4f0';
    c.fillRect(0, y0 + rh - 8, w, 8);
    for (let px = 5; px < w; px += 30 + rnd() * 18) {
      c.fillStyle = rnd() < 0.3 ? '#ffe14d' : '#fff';
      c.fillRect(px, y0 + rh - 7, 16, 6);
      c.fillStyle = CK_RED;
      c.fillRect(px + 2, y0 + rh - 5, 7, 2);
    }
    c.fillStyle = 'rgba(0,0,0,.28)';
    c.fillRect(0, y0 + rh - 9, w, 1.5);
  }
}
function poster(name: string, bg: string, draw: Draw) {
  alloc(name, 200, 280, (c, w, h) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    draw(c, w, h);
    c.strokeStyle = 'rgba(255,255,255,.9)';
    c.lineWidth = 6;
    c.strokeRect(3, 3, w - 6, h - 6);
  });
}
function cup(c: Ctx, x: number, y: number, w: number, h: number, col: string, lid = '#fff') {
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + w, y);
  c.lineTo(x + w * 0.85, y + h);
  c.lineTo(x + w * 0.15, y + h);
  c.closePath();
  c.fill();
  c.fillStyle = lid;
  c.fillRect(x - 4, y - 8, w + 8, 10);
}
function bowl(c: Ctx, x: number, y: number, r: number, col: string, food: string) {
  c.fillStyle = food;
  c.beginPath();
  c.ellipse(x, y, r, r * 0.35, 0, 0, 7);
  c.fill();
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(x - r, y);
  c.quadraticCurveTo(x, y + r * 1.3, x + r, y);
  c.closePath();
  c.fill();
}
function vMark(c: Ctx, x: number, y: number, s: number) {
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + s * 0.28, y);
  c.lineTo(x + s * 0.55, y + s * 0.62);
  c.lineTo(x + s * 0.95, y - s * 0.08);
  c.lineTo(x + s * 1.05, y - s * 0.02);
  c.lineTo(x + s * 0.55, y + s * 0.92);
  c.closePath();
  c.fill();
  c.fillStyle = '#f39a1e';
  c.beginPath();
  c.moveTo(x + s * 0.55, y + s * 0.92);
  c.lineTo(x + s * 0.62, y + s * 0.74);
  c.lineTo(x + s * 1.05, y - s * 0.02);
  c.lineTo(x + s * 0.95, y - s * 0.08);
  c.closePath();
  c.fill();
}

function drawAll() {
  alloc('white', 6, 6, (c, w, h) => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, w, h);
  });
  // --- 3-panel Circle K fascia, signs, bands ---
  alloc('ckPanel', 512, 128, redPanel);
  alloc('ckCenter', 1024, 200, (c, w, h) => {
    redPanel(c, w, h);
    txt(c, 'CIRCLE', w * 0.43, h * 0.42, 118, '#fff', 900);
    ckLogo(c, w * 0.82, h * 0.42, 70);
  });
  alloc('ckVert', 160, 320, (c, w, h) => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, w, h);
    c.fillStyle = CK_RED;
    c.fillRect(0, 0, w, h * 0.62);
    ckLogo(c, w / 2, h * 0.3, 58);
    c.fillStyle = CK_ORG;
    c.fillRect(0, h * 0.62, w, h * 0.08);
    txt(c, 'CỬA HÀNG', w / 2, h * 0.78, 22, '#333', 800);
    txt(c, 'TIỆN LỢI', w / 2, h * 0.88, 22, '#333', 800);
  });
  alloc('logoDisc', 256, 256, (c, w, h) => {
    c.fillStyle = CK_RED;
    c.fillRect(0, 0, w, h);
    ckLogo(c, 128, 128, 110);
  });
  alloc('glassBand', 1024, 48, (c, w, h) => {
    c.fillStyle = CK_RED;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff';
    c.fillRect(0, 0, w, 3);
    c.fillRect(0, h - 3, w, 3);
    for (let x = 20; x < w; x += 256) {
      txt(c, 'CIRCLE', x + 60, h / 2, 24, '#fff', 900);
      ckLogo(c, x + 138, h / 2, 15);
      txt(c, '24hrs', x + 196, h / 2, 20, '#fff', 700);
    }
  });
  alloc('welcome', 768, 110, (c, w, h) => {
    c.fillStyle = CK_RED;
    c.fillRect(0, 0, w, h);
    txt(c, 'CIRCLE K KÍNH CHÀO QUÝ KHÁCH', w / 2, 44, 40, '#fff', 800);
    txt(c, 'WELCOME', w / 2, 86, 28, '#fff', 600);
  });
  alloc('beverage', 768, 90, (c, w, h) => {
    c.fillStyle = CK_RED;
    c.fillRect(0, 0, w, h);
    c.fillStyle = CK_ORG;
    c.fillRect(0, h - 12, w, 12);
    txt(c, 'THỨC UỐNG  ·  BEVERAGE', w / 2, h / 2 - 4, 44, '#fff', 800);
  });
  // --- window posters ---
  poster('pMi', '#ffd400', (c, w) => {
    txt(c, 'MÌ LY', w / 2, 48, 52, CK_RED, 900);
    cup(c, 55, 90, 90, 100, '#fff');
    c.fillStyle = CK_RED;
    c.fillRect(62, 120, 76, 30);
    txt(c, 'NÓNG', w / 2, 135, 20, '#fff');
    c.fillStyle = CK_RED;
    c.beginPath();
    c.arc(150, 215, 40, 0, 7);
    c.fill();
    txt(c, '10K', 150, 215, 30, '#fff', 900);
    txt(c, 'chỉ từ', 60, 225, 22, '#7a1a00', 700);
  });
  poster('pTra', '#f6d7c3', (c, w) => {
    txt(c, 'TRÀ SỮA', w / 2, 44, 42, '#6b3a1f', 900);
    txt(c, 'trân châu', w / 2, 80, 24, '#6b3a1f', 600);
    cup(c, 62, 105, 76, 120, '#b07a4f', '#f2e8dc');
    c.fillStyle = '#3a1f10';
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      c.arc(72 + ((i * 7) % 56), 205 - (i % 3) * 8, 5, 0, 7);
      c.fill();
    }
    txt(c, '22K', w / 2, 255, 36, CK_RED, 900);
  });
  poster('p247', CK_RED, (c, w) => {
    ckLogo(c, w / 2, 74, 52);
    txt(c, 'MỞ CỬA', w / 2, 160, 40, '#fff', 900);
    txt(c, '24/7', w / 2, 215, 72, '#ffe14d', 900);
  });
  poster('pCom', '#1d8f4e', (c, w) => {
    txt(c, 'CƠM NẮM', w / 2, 44, 40, '#fff', 900);
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(100, 80);
    c.lineTo(160, 190);
    c.lineTo(40, 190);
    c.closePath();
    c.fill();
    c.fillStyle = '#111';
    c.fillRect(75, 150, 50, 40);
    txt(c, '15K', w / 2, 240, 48, '#ffe14d', 900);
  });
  poster('pCombo', '#0e3a7a', (c, w) => {
    txt(c, 'COMBO SÁNG', w / 2, 40, 30, '#ffe14d', 900);
    c.fillStyle = '#d9a25b';
    rr(c, 25, 80, 110, 48, 22);
    c.fill();
    c.fillStyle = '#7a3b10';
    c.fillRect(40, 95, 80, 6);
    cup(c, 130, 82, 48, 70, '#5a2d10');
    txt(c, 'Bánh mì + Cà phê', w / 2, 185, 22, '#fff', 700);
    txt(c, '25K', w / 2, 235, 52, '#fff', 900);
  });
  poster('pFrost', '#28b6e8', (c, w) => {
    txt(c, 'Trì Độ Mát', w / 2, 30, 24, '#ffe14d', 900);
    cup(c, 58, 70, 84, 150, '#14a35a', '#fff');
    c.fillStyle = '#e8346c';
    c.beginPath();
    c.ellipse(100, 72, 52, 32, 0, 0, 7);
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(100, 150, 22, 0, 7);
    c.fill();
    txt(c, 'F', 100, 151, 28, '#14a35a', 900);
    txt(c, 'FROSTER', w / 2, 250, 34, '#fff', 900);
  });
  poster('pWifi', '#ffffff', (c, w) => {
    c.strokeStyle = CK_RED;
    c.lineWidth = 12;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.arc(w / 2, 150, 30 + i * 28, -2.4, -0.74);
      c.stroke();
    }
    c.fillStyle = CK_RED;
    c.beginPath();
    c.arc(w / 2, 150, 10, 0, 7);
    c.fill();
    txt(c, 'WIFI', w / 2, 200, 44, CK_RED, 900);
    txt(c, 'miễn phí', w / 2, 240, 26, '#333', 700);
  });
  poster('pLau', '#fff4d6', (c, w) => {
    c.fillStyle = CK_RED;
    c.fillRect(0, 0, w, 64);
    txt(c, 'LẨU LY', w / 2, 34, 44, '#ffe14d', 900);
    bowl(c, 100, 140, 62, '#fff', '#e8541c');
    c.fillStyle = '#2f8a3a';
    for (let i = 0; i < 5; i++) c.fillRect(60 + i * 18, 120, 8, 14);
    txt(c, 'Nóng hổi!', w / 2, 206, 26, CK_RED, 800);
    txt(c, '19.000đ', w / 2, 246, 34, '#222', 900);
  });
  poster('pMiTron', '#f8b52a', (c, w) => {
    txt(c, 'MÌ TRỘN', w / 2, 40, 40, '#7a1500', 900);
    bowl(c, 100, 140, 64, '#fff', '#d9902e');
    c.strokeStyle = '#a86a1a';
    c.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      c.beginPath();
      c.moveTo(50 + i * 12, 128);
      c.quadraticCurveTo(70 + i * 10, 150, 60 + i * 12, 140);
      c.stroke();
    }
    txt(c, '25K', w / 2, 240, 48, CK_RED, 900);
  });
  poster('pCafeVN', '#3a2112', (c, w) => {
    txt(c, 'CÀ PHÊ', w / 2, 40, 40, '#ffd9a0', 900);
    txt(c, 'VIỆT NAM', w / 2, 78, 28, '#ffd9a0', 700);
    cup(c, 64, 110, 72, 100, '#c88a52', '#f0e2cf');
    c.fillStyle = '#5a3218';
    c.fillRect(72, 125, 56, 16);
    txt(c, '15K', w / 2, 245, 46, '#fff', 900);
  });
  poster('pKem', '#e9f6ff', (c, w) => {
    txt(c, 'KEM TƯƠI', w / 2, 40, 38, '#0b4ea2', 900);
    c.fillStyle = '#d9a25b';
    c.beginPath();
    c.moveTo(80, 150);
    c.lineTo(120, 150);
    c.lineTo(100, 230);
    c.closePath();
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(100, 130, 32, 0, 7);
    c.fill();
    c.fillStyle = '#ff9ec0';
    c.beginPath();
    c.arc(100, 100, 26, 0, 7);
    c.fill();
    txt(c, '8K', 160, 200, 36, CK_RED, 900);
  });
  poster('pKM', '#ffffff', (c, w) => {
    c.fillStyle = CK_RED;
    c.fillRect(0, 0, w, 56);
    txt(c, 'Khuyến Mãi', w / 2, 30, 34, '#fff', 900);
    for (let i = 0; i < 6; i++) {
      const y = 74 + i * 32;
      c.fillStyle = pick(PACK);
      c.fillRect(14, y, 34, 26);
      c.fillStyle = '#bbb';
      c.fillRect(56, y + 4, 80, 6);
      c.fillRect(56, y + 15, 56, 5);
      txt(c, 10 + Math.floor(rnd() * 30) + 'K', 170, y + 13, 20, CK_RED, 900);
    }
  });
  poster('thanhtoan', '#ffffff', (c, w) => {
    c.fillStyle = CK_RED;
    c.fillRect(0, 0, w, 60);
    txt(c, 'ĐIỂM THU TIỀN', w / 2, 26, 28, '#fff', 900);
    txt(c, 'Bill Payment', w / 2, 48, 16, '#fff', 600);
    const ic = ['#e94f37', '#1fa35a', '#2a7de1', '#d93a8c', '#f07c1b', '#7a3fc0'];
    for (let i = 0; i < 6; i++) {
      c.fillStyle = ic[i];
      rr(c, 18 + (i % 3) * 58, 76 + Math.floor(i / 3) * 60, 44, 44, 8);
      c.fill();
    }
    c.fillStyle = CK_RED;
    c.fillRect(0, 206, w, 34);
    txt(c, 'SIM SỐ · THẺ CÀO', w / 2, 223, 18, '#fff', 800);
    txt(c, 'Điện · Nước · Internet', w / 2, 258, 16, '#333', 700);
  });
  // --- interior signage / screens / goods ---
  alloc('shelf', 512, 256, (c, w, h) => products(c, w, h, 4));
  alloc('shelfB', 512, 256, (c, w, h) => products(c, w, h, 4, { small: true }));
  alloc('fridge', 768, 256, (c, w, h) => {
    products(c, w, h, 5, { bottles: true, bg: '#e8f3ff', back: '#dfeaf5' });
    c.fillStyle = 'rgba(255,255,255,.25)';
    c.fillRect(0, 0, w, 6);
  });
  alloc('labels', 512, 512, (c) => {
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 8; i++) {
        const x = i * 64,
          y = j * 64,
          col = pick(PACK),
          col2 = pick(PACK);
        c.fillStyle = col;
        c.fillRect(x, y, 64, 64);
        const g = c.createLinearGradient(x, 0, x + 64, 0);
        g.addColorStop(0, 'rgba(0,0,0,.25)');
        g.addColorStop(0.4, 'rgba(255,255,255,.15)');
        g.addColorStop(1, 'rgba(0,0,0,.3)');
        c.fillStyle = col2;
        if (rnd() < 0.5) {
          c.beginPath();
          c.arc(x + 32, y + 30, 14 + rnd() * 8, 0, 7);
          c.fill();
        } else c.fillRect(x + 6, y + 18 + rnd() * 12, 52, 16);
        c.fillStyle = 'rgba(255,255,255,.9)';
        c.fillRect(x + 8, y + 8, 30 + rnd() * 20, 7);
        c.fillStyle = 'rgba(0,0,0,.45)';
        c.fillRect(x + 8, y + 50, 40, 4);
        c.fillStyle = g;
        c.fillRect(x, y, 64, 64);
      }
  });
  const menuScreen = (name: string, bg: string, title: string, items: [string, string][]) =>
    alloc(name, 320, 192, (c, w, h) => {
      c.fillStyle = bg;
      c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,.12)';
      c.fillRect(0, 0, w, 36);
      txt(c, title, w / 2, 19, 22, '#fff', 800);
      items.forEach(([n, p], i) => {
        const x = 12 + (i % 2) * 154,
          y = 48 + Math.floor(i / 2) * 70;
        c.fillStyle = pick(['#e8a23a', '#c8562a', '#f2d28a', '#6b3a1f', '#e8346c', '#2ab7e8']);
        rr(c, x, y, 64, 58, 10);
        c.fill();
        txt(c, n, x + 72, y + 18, 15, '#fff', 700, 'left');
        txt(c, p, x + 72, y + 42, 20, '#ffd23f', 900, 'left');
      });
    });
  menuScreen('menuScr1', '#1c1c22', 'ĐỒ ĂN NÓNG', [
    ['Xúc xích', '15K'],
    ['Bánh bao', '12K'],
    ['Cơm gà', '35K'],
    ['Mì xào', '29K'],
  ]);
  menuScreen('menuScr2', '#c41c16', 'ĐỒ UỐNG', [
    ['Cà phê sữa', '15K'],
    ['Bạc xỉu', '18K'],
    ['Trà đào', '20K'],
    ['Froster', '12K'],
  ]);
  menuScreen('menuScr3', '#1c1c22', 'ĂN SÁNG', [
    ['Bánh mì', '15K'],
    ['Xôi gà', '20K'],
    ['Sandwich', '22K'],
    ['Sữa chua', '9K'],
  ]);
  alloc('tv', 320, 180, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#2a4fd6');
    g.addColorStop(1, '#0e2a8a');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    ckLogo(c, 62, h / 2, 34);
    txt(c, 'Circle K', 190, h / 2 - 22, 40, '#fff', 900);
    txt(c, 'xin cảm ơn!', 190, h / 2 + 24, 32, '#ffd23f', 800);
  });
  alloc('pos', 160, 110, (c, w) => {
    c.fillStyle = '#e9f1fb';
    c.fillRect(0, 0, w, 110);
    c.fillStyle = '#2a6fd6';
    c.fillRect(0, 0, w, 18);
    for (let i = 0; i < 8; i++) {
      c.fillStyle = pick(PACK);
      c.fillRect(8 + (i % 4) * 37, 26 + Math.floor(i / 4) * 40, 32, 34);
    }
  });
  alloc('hotfood', 256, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffcf7a');
    g.addColorStop(1, '#c96a1a');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      c.fillStyle = pick(['#c47a2c', '#8a4b1a', '#e9b25a', '#f3d28a']);
      rr(c, 8 + (i % 7) * 35, 20 + Math.floor(i / 7) * 52, 28, 34, 8);
      c.fill();
    }
  });
  alloc('froster', 128, 160, (c, w, h) => {
    c.fillStyle = '#1d1d22';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#28b6e8';
    c.fillRect(0, 0, w, 34);
    txt(c, 'FROSTER', w / 2, 17, 22, '#fff', 900);
    c.fillStyle = '#e8346c';
    rr(c, 10, 44, 48, 90, 10);
    c.fill();
    c.fillStyle = '#2a7de1';
    rr(c, 70, 44, 48, 90, 10);
    c.fill();
  });
  // --- street & neighbours ---
  const streetSign = (name: string, s1: string, s2: string) =>
    alloc(name, 320, 80, (c, w, h) => {
      c.fillStyle = '#0d57b5';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#fff';
      c.lineWidth = 4;
      c.strokeRect(5, 5, w - 10, h - 10);
      fitTxt(c, s1, w / 2, 32, 34, w - 30, '#fff', 800);
      txt(c, s2, w / 2, 60, 15, '#fff', 600);
    });
  streetSign('sign1', 'LÊ LAI', 'P. Bến Thành · Quận 1');
  streetSign('sign2', 'NGUYỄN TRÃI', 'P. Phạm Ngũ Lão · Quận 1');
  alloc('taphoa', 768, 160, (c, w, h) => {
    c.fillStyle = '#0b4ea2';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffd400';
    c.fillRect(0, 0, w, 8);
    c.fillRect(0, h - 8, w, 8);
    fitTxt(c, 'TẠP HÓA ÔNG MINH', w / 2, 62, 72, w - 40, '#ffd400', 900);
    txt(c, 'Bia · Nước ngọt · Bánh kẹo · Đồ gia dụng', w / 2, 118, 30, '#fff', 700);
  });
  alloc('karaoke', 320, 110, (c, w, h) => {
    c.fillStyle = '#160a1c';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#2ef0ff';
    c.lineWidth = 6;
    rr(c, 8, 8, w - 16, h - 16, 18);
    c.stroke();
    c.shadowColor = '#ff3ea5';
    c.shadowBlur = 16;
    txt(c, 'KARAOKE', w / 2, h / 2 + 2, 64, '#ff5bb5', 900);
    c.shadowBlur = 0;
  });
  alloc('phong', 256, 96, (c, w, h) => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, w, h);
    txt(c, 'CHO THUÊ PHÒNG', w / 2, 34, 28, '#c8102e', 900);
    txt(c, 'LH: 09xx xxx xxx', w / 2, 70, 24, '#0b3a8a', 700);
  });
  alloc('neighGoods', 512, 256, (c, w, h) =>
    products(c, w, h, 4, {
      bg: '#5a3a22',
      back: '#6b4a2e',
      pal: ['#c8102e', '#ffd400', '#1fa35a', '#2a7de1', '#f07c1b', '#ffffff', '#8a2be2', '#1b1b1b'],
    }),
  );
  const curtain = (name: string, base: string, cur: string) =>
    alloc(name, 256, 256, (c, w, h) => {
      const g = c.createRadialGradient(w * 0.5, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.7);
      g.addColorStop(0, base);
      g.addColorStop(1, shade(base, -90));
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(20,10,5,.55)';
      c.fillRect(w * 0.62, h * 0.45, w * 0.22, h * 0.55);
      c.fillRect(w * 0.1, h * 0.7, w * 0.3, h * 0.3);
      for (let i = 0; i < 2; i++) {
        const x0 = i ? w * 0.7 : 0,
          gg = c.createLinearGradient(x0, 0, x0 + w * 0.3, 0);
        for (let k = 0; k <= 6; k++) gg.addColorStop(k / 6, k % 2 ? shade(cur, -40) : cur);
        c.fillStyle = gg;
        c.fillRect(x0, 0, w * 0.3, h);
      }
      c.fillStyle = '#2a2a2a';
      for (let x = 0; x < w; x += 32) c.fillRect(x, 0, 4, h);
      c.fillRect(0, h / 2, w, 4);
    });
  curtain('winA', '#ffcf8a', '#d9b38c');
  curtain('winB', '#bfe3ff', '#8aa6c4');
  curtain('winC', '#ffb36b', '#a8463a');
  alloc('standee', 160, 240, (c, w, h) => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, w, h);
    c.fillStyle = CK_RED;
    c.fillRect(0, 0, w, 70);
    txt(c, 'CIRCLE', 62, 36, 26, '#fff', 900);
    ckLogo(c, 128, 35, 20);
    txt(c, 'Bánh mì', w / 2, 100, 26, '#222', 800);
    txt(c, '+ Cà phê', w / 2, 132, 26, '#222', 800);
    c.fillStyle = CK_ORG;
    c.beginPath();
    c.arc(w / 2, 190, 36, 0, 7);
    c.fill();
    txt(c, '25K', w / 2, 190, 28, '#fff', 900);
  });
  alloc('ac', 128, 96, (c, w, h) => {
    c.fillStyle = '#e9e9e4';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#3a3d40';
    c.beginPath();
    c.arc(w * 0.42, h / 2, 36, 0, 7);
    c.fill();
    c.strokeStyle = '#cfcfc8';
    c.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      c.beginPath();
      c.moveTo(w * 0.42 - 36, h / 2 - 30 + i * 10);
      c.lineTo(w * 0.42 + 36, h / 2 - 30 + i * 10);
      c.stroke();
    }
    c.fillStyle = 'rgba(80,60,40,.3)';
    c.fillRect(0, h - 10, w, 10);
  });
  const plate = (name: string, a: string, b: string) =>
    alloc(name, 128, 48, (c, w, h) => {
      c.fillStyle = '#f2f2ee';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#111';
      c.lineWidth = 3;
      c.strokeRect(2, 2, w - 4, h - 4);
      txt(c, a, w / 2, 15, 17, '#111', 800);
      txt(c, b, w / 2, 35, 19, '#111', 800);
    });
  plate('plate', '59-X1', '386.27');
  plate('plate2', '59-T2', '812.05');
  plate('plate3', '51K', '604.18');
  alloc('plaque', 512, 96, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#c9a45c');
    g.addColorStop(0.5, '#f0d89a');
    g.addColorStop(1, '#9a7434');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#5a4018';
    c.lineWidth = 3;
    c.strokeRect(6, 6, w - 12, h - 12);
    txt(c, 'GÓC PHỐ CIRCLE K · ĐÊM MƯA', w / 2, 38, 30, '#3a2a10', 800);
    txt(c, 'Sài Gòn · Tỉ lệ 1:50', w / 2, 70, 20, '#3a2a10', 600);
  });
  alloc('cafe', 256, 96, (c, w, h) => {
    c.fillStyle = '#3b2416';
    c.fillRect(0, 0, w, h);
    txt(c, 'BÁNH MÌ', w / 2, 36, 40, '#ffd23f', 900);
    txt(c, 'Ba Gà · Thịt nguội', w / 2, 74, 22, '#fff', 700);
  });
  alloc('wetfloor', 128, 200, (c, w, h) => {
    c.fillStyle = '#ffd000';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#111';
    c.beginPath();
    c.moveTo(w / 2, 18);
    c.lineTo(w - 20, 90);
    c.lineTo(20, 90);
    c.closePath();
    c.fill();
    txt(c, '!', w / 2, 66, 40, '#ffd000', 900);
    txt(c, 'CẨN THẬN', w / 2, 122, 20, '#111', 900);
    txt(c, 'SÀN ƯỚT', w / 2, 150, 22, '#111', 900);
    txt(c, 'Wet floor', w / 2, 180, 15, '#111', 600);
  });
  // --- ride-hailing liveries, scooter decals, plates ---
  alloc('xsmDoor', 384, 120, (c, w, h) => {
    c.fillStyle = XSM;
    c.fillRect(0, 0, w, h);
    vMark(c, 22, 26, 92);
    txt(c, 'XANH SM', w * 0.66, h * 0.4, 44, '#fff', 800);
    txt(c, 'TAXI', w * 0.66, h * 0.76, 30, '#f39a1e', 800);
  });
  alloc('xsmHot', 256, 64, (c, w, h) => {
    c.fillStyle = XSM;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff';
    rr(c, 6, 8, w - 12, h - 16, 10);
    c.fill();
    c.fillStyle = '#f39a1e';
    rr(c, 10, 12, w - 20, h - 24, 8);
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(34, h / 2, 14, 0, 7);
    c.fill();
    txt(c, '✆', 34, h / 2 + 1, 18, '#f39a1e', 800);
    txt(c, '1900 2088', w * 0.58, h / 2 + 1, 32, '#fff', 900);
  });
  alloc('taxiSign', 192, 64, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f6f7c8');
    g.addColorStop(1, '#d9e27a');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = XSM;
    c.fillRect(0, h - 12, w, 12);
    txt(c, 'TAXI', w / 2, h * 0.42, 40, '#0b5c66', 900);
  });
  const abDecal = (name: string, bg: string, fg: string) =>
    alloc(name, 256, 64, (c, w, h) => {
      c.fillStyle = bg;
      c.fillRect(0, 0, w, h);
      c.save();
      c.transform(1, 0, -0.25, 1, 8, 0);
      txt(c, 'AIR BLADE', w * 0.42, h * 0.46, 40, fg, 900);
      c.restore();
      c.fillStyle = fg;
      c.fillRect(w * 0.84, h * 0.25, 3, h * 0.45);
      txt(c, '150', w * 0.92, h * 0.48, 22, fg, 800);
    });
  abDecal('abRed', '#c8141b', '#f2f2f2');
  abDecal('abGray', '#3a3d42', '#c8955a');
  abDecal('abWhite', '#f2f2f2', '#c8141b');
  abDecal('abBlack', '#1b1b1d', '#d6d9dc');
  alloc('plateTaxi', 160, 56, (c, w, h) => {
    c.fillStyle = '#f2c230';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#111';
    c.lineWidth = 3;
    c.strokeRect(2, 2, w - 4, h - 4);
    txt(c, '51E-019.11', w / 2, h / 2 + 1, 30, '#111', 800);
  });
  alloc('xsmBack', 128, 96, (c, w) => {
    c.fillStyle = XSM;
    c.fillRect(0, 0, w, 96);
    txt(c, 'Xanh', w / 2, 34, 32, '#fff', 900);
    txt(c, 'SM', w / 2, 68, 34, '#fff', 900);
  });
  alloc('grabBack', 128, 96, (c, w, h) => {
    c.fillStyle = GRAB;
    c.fillRect(0, 0, w, h);
    txt(c, 'Grab', w / 2, h / 2 + 2, 46, '#fff', 900);
  });
  alloc('vfBadge', 64, 64, (c, w, h) => {
    c.fillStyle = '#d9d9d9';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#333';
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(12, 14);
    c.lineTo(32, 52);
    c.lineTo(52, 14);
    c.stroke();
  });
}

/** Draws the whole atlas once and returns the canvas (cached). */
export function buildAtlas(): HTMLCanvasElement {
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  canvas.width = ASW;
  canvas.height = ASH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D không khả dụng');
  AX = ctx;
  AX.fillStyle = '#fff';
  AX.fillRect(0, 0, ASW, ASH);
  seed(11);
  drawAll();
  return canvas;
}
