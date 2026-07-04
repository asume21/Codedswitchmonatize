import {
  findActiveLyricLine,
  findNextLyricLine,
  resolveLyricLineTiming,
  type LyricVideoLine,
} from './lyricVideoTiming';

export type FontKey = 'Inter' | 'Impact' | 'Serif' | 'Mono';

// Reliable system-available families (no async font loading needed for canvas).
export const FONT_FAMILIES: Record<FontKey, string> = {
  Inter: 'Inter, ui-sans-serif, system-ui, sans-serif',
  Impact: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
  Serif: 'Georgia, "Times New Roman", serif',
  Mono: '"Courier New", ui-monospace, monospace',
};

export type AnimStyle = 'none' | 'fade' | 'pop' | 'slide';

// Text measurement cache to avoid heavy ctx.measureText calls in the animation loop
const textWidthCache = new Map<string, number>();

function getCachedTextWidth(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  const key = `${font}:${text}`;
  let width = textWidthCache.get(key);
  if (width === undefined) {
    const prevFont = ctx.font;
    ctx.font = font;
    width = ctx.measureText(text).width;
    ctx.font = prevFont;
    textWidthCache.set(key, width);
    // Limit cache size to prevent memory leaks
    if (textWidthCache.size > 2000) {
      const firstKey = textWidthCache.keys().next().value;
      if (firstKey !== undefined) textWidthCache.delete(firstKey);
    }
  }
  return width;
}

// Runs `draw` inside a transform that eases the active line/word in as it appears.
// `enter` is 0→1 progress; at >= 1 it's a no-op so past content stays static.
function withEntrance(
  ctx: CanvasRenderingContext2D,
  style: AnimStyle,
  enter: number,
  cx: number,
  cy: number,
  draw: () => void,
) {
  if (style === 'none' || enter >= 1) {
    draw();
    return;
  }
  const e = Math.max(0, Math.min(1, enter));
  ctx.save();
  ctx.globalAlpha = e;
  if (style === 'pop') {
    const scale = 0.7 + 0.3 * e;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
  } else if (style === 'slide') {
    ctx.translate(0, (1 - e) * 40);
  }
  draw();
  ctx.restore();
}

function drawWordRow(
  ctx: CanvasRenderingContext2D,
  tokens: Array<{ text: string; active: boolean }>,
  y: number,
  fontSize: number,
  maxWidth: number,
  fontFamily: string,
  canvasWidth: number,
) {
  const font = `800 ${fontSize}px ${fontFamily}`;
  ctx.font = font;
  const spaceWidth = getCachedTextWidth(ctx, ' ', font);
  const tokenWidths = tokens.map((token) => getCachedTextWidth(ctx, token.text, font));
  const totalWidth = tokenWidths.reduce((sum, width) => sum + width, 0) + spaceWidth * Math.max(0, tokens.length - 1);
  let x = (canvasWidth - Math.min(totalWidth, maxWidth)) / 2;

  tokens.forEach((token, index) => {
    ctx.fillStyle = token.active ? '#22d3ee' : '#f8fafc';
    ctx.fillText(token.text, x, y);
    x += tokenWidths[index] + spaceWidth;
  });
}

function drawWrappedWords(
  ctx: CanvasRenderingContext2D,
  words: Array<{ text: string; active: boolean }>,
  centerY: number,
  requestedFontSize: number,
  fontFamily: string,
  canvasWidth: number,
) {
  const maxWidth = canvasWidth * 0.84;
  let fontSize = requestedFontSize;
  let rows: Array<Array<{ text: string; active: boolean }>> = [];

  while (fontSize >= 34) {
    const font = `800 ${fontSize}px ${fontFamily}`;
    ctx.font = font;
    rows = [];
    let currentRow: Array<{ text: string; active: boolean }> = [];
    let currentWidth = 0;
    const spaceWidth = getCachedTextWidth(ctx, ' ', font);

    words.forEach((word) => {
      const wordWidth = getCachedTextWidth(ctx, word.text, font);
      const nextWidth = currentRow.length === 0 ? wordWidth : currentWidth + spaceWidth + wordWidth;
      if (currentRow.length > 0 && nextWidth > maxWidth) {
        rows.push(currentRow);
        currentRow = [word];
        currentWidth = wordWidth;
      } else {
        currentRow.push(word);
        currentWidth = nextWidth;
      }
    });

    if (currentRow.length > 0) rows.push(currentRow);
    const widestRow = rows.reduce((widest, row) => {
      const rowWidth = row.reduce((sum, word, index) => {
        return sum + getCachedTextWidth(ctx, word.text, font) + (index === 0 ? 0 : spaceWidth);
      }, 0);
      return Math.max(widest, rowWidth);
    }, 0);
    if (rows.length <= 2 && widestRow <= maxWidth) break;
    fontSize -= 4;
  }

  const lineHeight = fontSize * 1.24;
  const firstY = centerY - ((rows.length - 1) * lineHeight) / 2;
  rows.forEach((row, index) => {
    drawWordRow(ctx, row, firstY + index * lineHeight, fontSize, maxWidth, fontFamily, canvasWidth);
  });
}

function buildCanvasWords(
  line: ReturnType<typeof resolveLyricLineTiming>,
  currentTime: number,
  wordShift: number,
  speed: number,
) {
  if (line.words.length === 0) {
    return line.text.split(/\s+/).filter(Boolean).map((text) => ({ text, active: false, started: true }));
  }

  return line.words.map((word) => {
    const start = word.start * speed + wordShift;
    const end = word.end * speed + wordShift;
    return {
      text: word.text,
      active: currentTime >= start && currentTime < end,
      started: currentTime >= start,
    };
  });
}

function drawFlashWord(
  ctx: CanvasRenderingContext2D,
  text: string,
  timeSinceStart: number,
  baseFontSize: number,
  fontFamily: string,
  canvasWidth: number,
  canvasHeight: number,
) {
  const pop = Math.min(1, Math.max(0, timeSinceStart / 0.09));
  const size = Math.min(170, baseFontSize * 1.7) * (0.82 + 0.18 * pop);
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.65 * pop;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px ${fontFamily}`;
  ctx.fillStyle = '#22d3ee';
  ctx.shadowColor = 'rgba(34, 211, 238, 0.55)';
  ctx.shadowBlur = 34;
  ctx.fillText(text.toUpperCase(), canvasWidth / 2, canvasHeight / 2);
  ctx.restore();
}

function drawBeatPulse(ctx: CanvasRenderingContext2D, currentTime: number, bpm: number, canvasWidth: number, canvasHeight: number) {
  const beatLength = 60 / Math.max(1, bpm);
  const beatNumber = Math.floor(currentTime / beatLength) % 4;
  const x = canvasWidth / 2 - 54;
  const y = canvasHeight - 82;

  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.fillStyle = i === beatNumber ? '#22d3ee' : '#1e293b';
    ctx.arc(x + i * 36, y, i === beatNumber ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function renderLyricFrame({
  canvas,
  lines,
  currentTime,
  offsetSec,
  bpm,
  snapToBeat,
  fontSize,
  revealMode,
  showNextLine,
  speed,
  fontFamily,
  animStyle,
  canvasWidth = 1280,
  canvasHeight = 720,
}: {
  canvas: HTMLCanvasElement;
  lines: LyricVideoLine[];
  currentTime: number;
  offsetSec: number;
  bpm: number;
  snapToBeat: boolean;
  fontSize: number;
  revealMode: 'line' | 'build' | 'word';
  showNextLine: boolean;
  speed: number;
  fontFamily: string;
  animStyle: AnimStyle;
  canvasWidth?: number;
  canvasHeight?: number;
}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const timingOptions = { offsetSec, bpm, snapToBeat, speed };
  const activeLine = findActiveLyricLine(lines, currentTime, timingOptions);
  const nextLine = findNextLyricLine(lines, currentTime, timingOptions);
  const displayLine = activeLine ?? nextLine;

  if (!displayLine) {
    ctx.fillStyle = '#64748b';
    ctx.font = `700 54px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText('LYRICS READY', canvasWidth / 2, canvasHeight / 2);
    ctx.textAlign = 'left';
    return;
  }

  const resolved = activeLine ?? resolveLyricLineTiming(displayLine, timingOptions);
  const wordShift = offsetSec + resolved.timingShift;
  ctx.textBaseline = 'middle';

  // Ease the active line in as it appears; other lines render fully (no anim).
  const enter = activeLine
    ? Math.min(1, Math.max(0, (currentTime - resolved.displayStart) / 0.22))
    : 1;

  // One-word flash: only the current word, large & centered. Ignores line layout.
  if (revealMode === 'word' && displayLine.words.length > 0) {
    let current: { text: string; start: number } | null = null;
    for (const word of displayLine.words) {
      const start = word.start * speed + wordShift;
      if (currentTime >= start) current = { text: word.text, start };
      else break;
    }
    if (current) drawFlashWord(ctx, current.text, currentTime - current.start, fontSize, fontFamily, canvasWidth, canvasHeight);
    drawBeatPulse(ctx, currentTime, bpm, canvasWidth, canvasHeight);
    return;
  }

  let words = buildCanvasWords(resolved, currentTime, wordShift, speed);
  // Build-up: reveal words one at a time as they're sung (nothing to read ahead).
  if (revealMode === 'build') {
    words = words.filter((word) => word.started);
  }

  ctx.shadowColor = 'rgba(34, 211, 238, 0.28)';
  ctx.shadowBlur = activeLine ? 20 : 0;
  withEntrance(ctx, animStyle, enter, canvasWidth / 2, canvasHeight / 2, () => {
    drawWrappedWords(ctx, words, canvasHeight / 2, fontSize, fontFamily, canvasWidth);
  });
  ctx.shadowBlur = 0;

  if (showNextLine && activeLine && nextLine && nextLine.id !== activeLine.id) {
    ctx.globalAlpha = 0.42;
    ctx.font = `700 ${Math.max(26, Math.round(fontSize * 0.42))}px ${fontFamily}`;
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText(nextLine.text, canvasWidth / 2, canvasHeight / 2 + fontSize * 1.45);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  drawBeatPulse(ctx, currentTime, bpm, canvasWidth, canvasHeight);
}
