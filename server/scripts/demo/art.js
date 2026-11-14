// Procedural "digital paintings" for the demo data: SVG scenes rendered to JPEG/PNG with sharp.
// Deterministic: the same seed always gives the same picture.
const sharp = require('sharp');

function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const PALETTES = {
    dusk: ['#1B1340', '#4B2A7B', '#C9507E', '#F59A6B', '#FFD9A0'],
    violet: ['#120E2E', '#3A2A8C', '#7B5CF0', '#F2A65A', '#FFE3B3'],
    mint: ['#0E2A2A', '#1F5C57', '#4FB3A0', '#A8E6CF', '#F4FFF8'],
    ember: ['#1A0B0B', '#5A1A12', '#C2401F', '#F28B30', '#FFD27A'],
    ocean: ['#07162B', '#103E66', '#2B7BB9', '#7EC8E3', '#F1E9DA'],
    forest: ['#0F1A12', '#22402B', '#4F7A4A', '#C7B86B', '#F3E7C2'],
    candy: ['#2B1036', '#7A2E8E', '#F06BA8', '#FFC2D1', '#FFF4E0'],
    paper: ['#F2EADB', '#E8402E', '#1F3A93', '#F2B90C', '#141414'],
    neon: ['#0B0620', '#2D0B59', '#FF3CAC', '#2BD2FF', '#FDEB71'],
    sand: ['#2E2219', '#7A5236', '#C98B5A', '#E9C79A', '#FBF1E1'],
};
const PALETTE_NAMES = Object.keys(PALETTES);

const pick = (r, list) => list[Math.floor(r() * list.length)];
const between = (r, a, b) => a + r() * (b - a);
const f = (n) => Math.round(n * 10) / 10;

const grain = (id, opacity = 0.12) => `
  <filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/></filter>`;
const grainRect = (id, w, h, opacity = 0.1) =>
    `<rect width="${w}" height="${h}" filter="url(#${id})" opacity="${opacity}" style="mix-blend-mode:overlay"/>`;

// Ridge line of a mountain layer (midpoint displacement)
function ridge(r, w, baseY, rough) {
    let pts = [[0, baseY + between(r, -rough, rough)], [w, baseY + between(r, -rough, rough)]];
    let amp = rough;
    for (let i = 0; i < 7; i++) {
        const next = [];
        for (let j = 0; j < pts.length - 1; j++) {
            const [x1, y1] = pts[j];
            const [x2, y2] = pts[j + 1];
            next.push(pts[j], [(x1 + x2) / 2, (y1 + y2) / 2 + between(r, -amp, amp)]);
        }
        next.push(pts[pts.length - 1]);
        pts = next;
        amp *= 0.55;
    }
    return pts;
}
const ridgePath = (pts, w, h) => `M0,${h} ${pts.map(([x, y]) => `L${f(x)},${f(y)}`).join(' ')} L${w},${h} Z`;

const scenes = {
    landscape(r, w, h, p) {
        const sunX = between(r, 0.2, 0.8) * w;
        const sunY = between(r, 0.28, 0.45) * h;
        const layers = 4;
        let m = '';
        for (let i = 0; i < layers; i++) {
            const t = i / (layers - 1);
            const y = h * (0.45 + t * 0.32);
            const color = [p[2], p[1], p[1], p[0]][i];
            m += `<path d="${ridgePath(ridge(r, w, y, h * (0.12 - t * 0.06)), w, h)}" fill="${color}" opacity="${f(0.55 + t * 0.45)}"/>`;
            if (i < layers - 1) m += `<rect y="${f(y - h * 0.04)}" width="${w}" height="${f(h * 0.12)}" fill="${p[4]}" opacity="0.08" filter="url(#blur)"/>`;
        }
        return `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${p[1]}"/><stop offset="0.55" stop-color="${p[3]}"/><stop offset="1" stop-color="${p[4]}"/></linearGradient>
            <radialGradient id="glow"><stop offset="0" stop-color="${p[4]}" stop-opacity="0.9"/><stop offset="1" stop-color="${p[4]}" stop-opacity="0"/></radialGradient>
            <filter id="blur"><feGaussianBlur stdDeviation="${f(h * 0.02)}"/></filter>${grain('g')}</defs>
          <rect width="${w}" height="${h}" fill="url(#sky)"/>
          <circle cx="${f(sunX)}" cy="${f(sunY)}" r="${f(w * 0.32)}" fill="url(#glow)"/>
          <circle cx="${f(sunX)}" cy="${f(sunY)}" r="${f(w * 0.075)}" fill="${p[4]}"/>
          ${m}${grainRect('g', w, h)}`;
    },

    aurora(r, w, h, p) {
        let blobs = '';
        for (let i = 0; i < 6; i++) {
            blobs += `<ellipse cx="${f(between(r, 0, w))}" cy="${f(between(r, 0, h))}" rx="${f(between(r, 0.25, 0.55) * w)}" ry="${f(between(r, 0.18, 0.4) * h)}"
              fill="${p[1 + (i % 4)]}" opacity="${f(between(r, 0.55, 0.95))}" transform="rotate(${f(between(r, -40, 40))} ${w / 2} ${h / 2})"/>`;
        }
        return `<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${f(w * 0.06)}"/></filter>${grain('g')}</defs>
          <rect width="${w}" height="${h}" fill="${p[0]}"/><g filter="url(#b)">${blobs}</g>${grainRect('g', w, h, 0.16)}`;
    },

    city(r, w, h, p) {
        const horizon = h * between(r, 0.62, 0.72);
        let b = '';
        let x = -10;
        while (x < w) {
            const bw = between(r, 0.06, 0.14) * w;
            const bh = between(r, 0.15, 0.5) * h;
            const top = horizon - bh;
            b += `<rect x="${f(x)}" y="${f(top)}" width="${f(bw)}" height="${f(bh)}" fill="${p[0]}"/>`;
            for (let wy = top + 12; wy < horizon - 10; wy += 18) {
                for (let wx = x + 8; wx < x + bw - 8; wx += 14) {
                    if (r() < 0.32) b += `<rect x="${f(wx)}" y="${f(wy)}" width="6" height="9" fill="${pick(r, [p[3], p[4], p[4]])}" opacity="${f(between(r, 0.5, 1))}"/>`;
                }
            }
            x += bw + between(r, 0, 0.02) * w;
        }
        return `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${p[0]}"/><stop offset="0.7" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient>
            <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[0]}"/></linearGradient>
            <filter id="ref"><feGaussianBlur stdDeviation="3 10"/></filter>${grain('g')}</defs>
          <rect width="${w}" height="${h}" fill="url(#sky)"/>
          <circle cx="${f(between(r, 0.15, 0.85) * w)}" cy="${f(h * 0.16)}" r="${f(w * 0.05)}" fill="${p[4]}" opacity="0.9"/>
          ${b}
          <rect y="${f(horizon)}" width="${w}" height="${f(h - horizon)}" fill="url(#water)"/>
          <g transform="translate(0 ${f(horizon * 2)}) scale(1 -1)" opacity="0.35" filter="url(#ref)">${b}</g>
          ${grainRect('g', w, h, 0.14)}`;
    },

    bauhaus(r, w, h, p) {
        const [bg, ...ink] = p;
        let s = '';
        const cell = w / 4;
        for (let i = 0; i < 9; i++) {
            const cx = Math.floor(between(r, 0, 4)) * cell;
            const cy = Math.floor(between(r, 0, h / cell)) * cell;
            const c = pick(r, ink);
            const kind = Math.floor(r() * 4);
            if (kind === 0) s += `<circle cx="${f(cx + cell / 2)}" cy="${f(cy + cell / 2)}" r="${f(cell / 2)}" fill="${c}"/>`;
            if (kind === 1) s += `<path d="M${f(cx)},${f(cy + cell)} A${f(cell)},${f(cell)} 0 0 1 ${f(cx + cell)},${f(cy)} L${f(cx + cell)},${f(cy + cell)} Z" fill="${c}"/>`;
            if (kind === 2) s += `<rect x="${f(cx)}" y="${f(cy)}" width="${f(cell)}" height="${f(cell / 2)}" fill="${c}"/>`;
            if (kind === 3) s += `<path d="M${f(cx)},${f(cy + cell)} L${f(cx + cell / 2)},${f(cy)} L${f(cx + cell)},${f(cy + cell)} Z" fill="${c}"/>`;
        }
        s += `<line x1="0" y1="${f(between(r, 0.2, 0.8) * h)}" x2="${w}" y2="${f(between(r, 0.2, 0.8) * h)}" stroke="${ink[3]}" stroke-width="${f(w * 0.012)}"/>`;
        return `<defs>${grain('g')}</defs><rect width="${w}" height="${h}" fill="${bg}"/>${s}${grainRect('g', w, h, 0.18)}`;
    },

    synthwave(r, w, h, p) {
        const horizon = h * 0.6;
        const sunR = w * between(r, 0.2, 0.28);
        let stripes = '';
        for (let i = 0; i < 6; i++) {
            const y = horizon - sunR * 0.55 + i * sunR * 0.12;
            stripes += `<rect x="0" y="${f(y)}" width="${w}" height="${f(sunR * 0.03 + i * 2.5)}" fill="${p[0]}"/>`;
        }
        let grid = '';
        for (let i = -12; i <= 12; i++) grid += `<line x1="${f(w / 2 + i * w * 0.02)}" y1="${f(horizon)}" x2="${f(w / 2 + i * w * 0.22)}" y2="${h}" stroke="${p[2]}" stroke-width="2" opacity="0.8"/>`;
        for (let i = 1; i < 14; i++) {
            const y = horizon + (h - horizon) * Math.pow(i / 13, 2.2);
            grid += `<line x1="0" y1="${f(y)}" x2="${w}" y2="${f(y)}" stroke="${p[3]}" stroke-width="2" opacity="0.7"/>`;
        }
        return `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient>
            <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[4]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient>
            <clipPath id="sc"><circle cx="${w / 2}" cy="${f(horizon - sunR * 0.25)}" r="${f(sunR)}"/></clipPath>${grain('g')}</defs>
          <rect width="${w}" height="${h}" fill="url(#sky)"/>
          <g clip-path="url(#sc)"><rect width="${w}" height="${f(horizon)}" fill="url(#sun)"/>${stripes}</g>
          <path d="${ridgePath(ridge(r, w, horizon - h * 0.04, h * 0.05), w, horizon + 2)}" fill="${p[0]}" opacity="0.9"/>
          <rect y="${f(horizon)}" width="${w}" height="${f(h - horizon)}" fill="${p[0]}"/>${grid}${grainRect('g', w, h, 0.12)}`;
    },

    sea(r, w, h, p) {
        const horizon = h * between(r, 0.48, 0.58);
        const sunX = w * between(r, 0.3, 0.7);
        let glints = '';
        for (let i = 0; i < 70; i++) {
            const y = horizon + Math.pow(r(), 1.6) * (h - horizon);
            const spread = (y - horizon) / (h - horizon);
            glints += `<rect x="${f(sunX + between(r, -1, 1) * w * (0.05 + spread * 0.25))}" y="${f(y)}" width="${f(between(r, 10, 60) * (0.4 + spread))}" height="3" rx="1.5" fill="${p[4]}" opacity="${f(between(r, 0.3, 0.9))}"/>`;
        }
        const boat = r() < 0.6
            ? `<path d="M${f(w * 0.68)},${f(horizon + h * 0.08)} l${f(w * 0.08)},0 l-${f(w * 0.012)},${f(h * 0.012)} l-${f(w * 0.056)},0 Z M${f(w * 0.715)},${f(horizon + h * 0.078)} l0,-${f(h * 0.07)} l${f(w * 0.035)},${f(h * 0.062)} Z" fill="${p[0]}"/>`
            : '';
        return `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[1]}"/><stop offset="0.75" stop-color="${p[3]}"/><stop offset="1" stop-color="${p[4]}"/></linearGradient>
            <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[2]}"/><stop offset="1" stop-color="${p[0]}"/></linearGradient>
            <filter id="soft"><feGaussianBlur stdDeviation="1.2"/></filter>${grain('g')}</defs>
          <rect width="${w}" height="${h}" fill="url(#sky)"/>
          <circle cx="${f(sunX)}" cy="${f(horizon - h * 0.02)}" r="${f(w * 0.08)}" fill="${p[4]}"/>
          <rect y="${f(horizon)}" width="${w}" height="${f(h - horizon)}" fill="url(#sea)"/>
          <g filter="url(#soft)">${glints}</g>${boat}${grainRect('g', w, h, 0.12)}`;
    },

    botanical(r, w, h, p) {
        let s = '';
        for (let i = 0; i < 7; i++) {
            const x = between(r, 0.12, 0.88) * w;
            const top = between(r, 0.15, 0.5) * h;
            const bend = between(r, -0.12, 0.12) * w;
            s += `<path d="M${f(x)},${h} Q${f(x + bend)},${f((h + top) / 2)} ${f(x + bend / 2)},${f(top)}" stroke="${p[1]}" stroke-width="${f(w * 0.006)}" fill="none"/>`;
            const petals = 5 + Math.floor(r() * 4);
            const pr = between(r, 0.035, 0.07) * w;
            const color = pick(r, [p[2], p[3], p[4]]);
            for (let k = 0; k < petals; k++) {
                s += `<ellipse cx="${f(x + bend / 2)}" cy="${f(top - pr)}" rx="${f(pr * 0.45)}" ry="${f(pr)}" fill="${color}" opacity="0.9" transform="rotate(${f((360 / petals) * k)} ${f(x + bend / 2)} ${f(top)})"/>`;
            }
            s += `<circle cx="${f(x + bend / 2)}" cy="${f(top)}" r="${f(pr * 0.35)}" fill="${p[0]}"/>`;
            for (let k = 0; k < 2; k++) {
                const ly = top + between(r, 0.2, 0.7) * (h - top);
                const dir = k ? 1 : -1;
                s += `<ellipse cx="${f(x + dir * w * 0.04)}" cy="${f(ly)}" rx="${f(w * 0.045)}" ry="${f(w * 0.014)}" fill="${p[1]}" transform="rotate(${dir * -30} ${f(x)} ${f(ly)})"/>`;
            }
        }
        return `<defs><radialGradient id="bg" cx="0.5" cy="0.35" r="0.8"><stop offset="0" stop-color="${p[4]}"/><stop offset="1" stop-color="${p[3]}"/></radialGradient>${grain('g')}</defs>
          <rect width="${w}" height="${h}" fill="url(#bg)"/>${s}${grainRect('g', w, h, 0.14)}`;
    },
};
const SCENES = Object.keys(scenes);

const RATIOS = { portrait: [4, 5], tall: [3, 4], square: [1, 1], wide: [3, 2], poster: [2, 3] };

async function painting({ seed, scene, palette, ratio = 'portrait', width = 1400, format = 'jpeg' }) {
    const r = rng(seed);
    const [rw, rh] = RATIOS[ratio];
    const w = width;
    const h = Math.round((width * rh) / rw);
    const p = PALETTES[palette || pick(r, PALETTE_NAMES)];
    const body = scenes[scene || pick(r, SCENES)](r, w, h, p);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
    const img = sharp(Buffer.from(svg));
    const buffer = format === 'png' ? await img.png({ compressionLevel: 9 }).toBuffer()
        : format === 'webp' ? await img.webp({ quality: 86 }).toBuffer()
            : await img.jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    return { buffer, width: w, height: h };
}

// Soft gradient avatar (square, shown in a circle)
async function avatar(seed, palette) {
    const r = rng(seed);
    const p = PALETTES[palette];
    const s = 400;
    const body = `<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60"/></filter></defs>
      <rect width="${s}" height="${s}" fill="${p[1]}"/><g filter="url(#b)">
      ${[2, 3, 4].map((i) => `<circle cx="${f(between(r, 0, s))}" cy="${f(between(r, 0, s))}" r="${f(between(r, 120, 200))}" fill="${p[i]}"/>`).join('')}</g>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">${body}</svg>`;
    return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

module.exports = { painting, avatar, rng, PALETTES, PALETTE_NAMES, SCENES };
