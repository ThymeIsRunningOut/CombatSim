import defaultColors from 'tailwindcss/colors.js';

/**
 * UI palette saturation. 1.0 = stock Tailwind; lower = calmer UI.
 * Every Tailwind color scale (cyan, amber, emerald, …) is desaturated by this factor in HSL.
 * Canvas/entity colors defined in data (hex) are not affected.
 */
const UI_SATURATION = 0.75;

const PALETTES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime', 'green',
  'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
];

function desaturateHex(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, sat = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  sat *= factor;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (sat === 0) { r = g = b = l; } else {
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
  }
  const to = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

const mutedColors = Object.fromEntries(
  PALETTES.map((name) => [
    name,
    Object.fromEntries(Object.entries(defaultColors[name]).map(([k, v]) => [k, desaturateHex(v, UI_SATURATION)])),
  ])
);

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors: {
      inherit: 'inherit',
      current: 'currentColor',
      transparent: 'transparent',
      black: '#000000',
      white: '#ffffff',
      ...mutedColors,
    },
    extend: {
      colors: {
        ocean: {
          950: '#060d17',
          900: '#0a192f',
          800: '#0f2744',
          700: '#173b64',
          600: '#1e4e85',
        },
        behemoth: {
          hull: '#3b82f6',
          metal: '#1e293b',
          glow: '#60a5fa',
        },
        danger: {
          ram: '#ef4444',
          tilt: '#f97316',
        }
      }
    },
  },
  plugins: [],
}
