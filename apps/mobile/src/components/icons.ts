// Stroke icons from the Hi-fi A design (24 × 24 grid, round caps and joins). Data only; rendered by <Icon>.
export type IconShape =
  | { kind: 'path'; d: string }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx: number };

const p = (d: string): IconShape => ({ kind: 'path', d });
const c = (cx: number, cy: number, r: number): IconShape => ({ kind: 'circle', cx, cy, r });
const r = (x: number, y: number, width: number, height: number, rx: number): IconShape => ({
  kind: 'rect',
  x,
  y,
  width,
  height,
  rx,
});

export const icons = {
  back: [p('m15 18-6-6 6-6')],
  chevronRight: [p('m9 18 6-6-6-6')],
  chevronDown: [p('m6 9 6 6 6-6')],
  close: [p('M6 6l12 12M18 6 6 18')],
  check: [p('M5 12.5l4.5 4.5L19 7')],
  plus: [p('M12 5v14M5 12h14')],
  search: [c(11, 11, 7), p('m20 20-4-4')],
  more: [c(5, 12, 1.2), c(12, 12, 1.2), c(19, 12, 1.2)],
  grip: [c(9, 6, 1.2), c(15, 6, 1.2), c(9, 12, 1.2), c(15, 12, 1.2), c(9, 18, 1.2), c(15, 18, 1.2)],
  download: [p('M12 4v11M7 10l5 5 5-5M5 20h14')],
  share: [p('M12 3v12M7 8l5-5 5 5M5 14v6h14v-6')],
  link: [
    p('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1'),
    p('M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'),
  ],
  lock: [r(5, 11, 14, 10, 2), p('M8 11V7a4 4 0 0 1 8 0v4')],
  warning: [p('M12 3 2 20h20z'), p('M12 10v4M12 17v.5')],
  retry: [p('M3 12a9 9 0 1 0 3-6.7L3 8'), p('M3 3v5h5')],
  clock: [p('M12 6v6l4 2'), c(12, 12, 9)],
  wifiOff: [p('M2 8.8a15 15 0 0 1 20 0'), p('M5 12.5a10 10 0 0 1 14 0'), p('M8.5 16a5 5 0 0 1 7 0'), p('M3 3l18 18')],
  settings: [
    c(12, 12, 3),
    p(
      'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    ),
  ],
  // Tab bar
  today: [p('M4.5 4.5 19 3l1.5 12.5-12 1.5-3 4z')],
  capture: [p('M4 8h3l2-3h6l2 3h3v11H4z'), c(12, 13, 3.5)],
  jars: [
    p('M8.5 2.5h7v3h-7z'),
    p('M7.5 5.5h9a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3z'),
    p('M4.5 13.5h15'),
  ],
  myDays: [r(3.5, 5, 17, 15, 3), p('M3.5 10h17M8 3v4M16 3v4')],
  // Moment slots
  whereami: [p('M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z'), c(12, 10, 2.3)],
  mebusywith: [
    p(
      'M8 12V6.5a1.5 1.5 0 0 1 3 0V11m0-5.5V4.5a1.5 1.5 0 0 1 3 0V11m0-4a1.5 1.5 0 0 1 3 0v6.5a7 7 0 0 1-7 7h-.5A6 6 0 0 1 5 17.6l-1.6-2.8a1.5 1.5 0 0 1 2.5-1.6L8 15',
    ),
  ],
  whoamiwith: [c(9, 8, 3), c(17, 9, 2.5), p('M3.5 19a5.5 5.5 0 0 1 11 0M14.5 15.2A4.5 4.5 0 0 1 21 19')],
  ootd: [p('M10 6a2 2 0 1 1 2 2v1.5m0 0L3 16.5h18z')],
  selfie: [c(12, 9, 5), p('M5 21c1-3.5 4-5 7-5s6 1.5 7 5')],
  morning: [p('M7 17a5 5 0 0 1 10 0'), p('M2 17h20M12 6v3M4.5 9.5l2 2M19.5 9.5l-2 2')],
  afternoon: [
    c(12, 12, 4),
    p('M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4'),
  ],
  evening: [p('M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z')],
  // Camera
  flash: [p('M13 2 4 14h7l-1 8 9-12h-7z')],
  flashOff: [p('M13 2 4 14h7l-1 8 9-12h-7z'), p('M3 3l18 18')],
  flip: [p('M20 11a8 8 0 0 0-14.3-4.9L4 8'), p('M4 3v5h5'), p('M4 13a8 8 0 0 0 14.3 4.9L20 16'), p('M20 21v-5h-5')],
  gallery: [r(3.5, 3.5, 17, 17, 3), c(9, 9, 1.8), p('m20.5 15-5-5-11 10.5')],
  cameraOff: [p('M4 8h3l2-3h6l2 3h3v11H4z'), c(12, 13, 3.5), p('M3 3l18 18')],
  // Crop
  rotate: [p('M3 12a9 9 0 1 0 3-6.7L3 8'), p('M3 3v5h5')],
  mirror: [p('M12 3v18M8 7l-5 5 5 5M16 7l5 5-5 5')],
  fit: [p('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5')],
  reset: [p('M9 14 4 9l5-5'), p('M4 9h10.5a5.5 5.5 0 0 1 0 11H11')],
  zoomOut: [c(11, 11, 7), p('m20 20-4-4M8 11h6')],
  zoomIn: [c(11, 11, 7), p('m20 20-4-4M8 11h6M11 8v6')],
  alignLeft: [p('M4 6h16M4 12h10M4 18h13')],
  alignCenter: [p('M4 6h16M7 12h10M5.5 18h13')],
  // Moment options
  caption: [p('M4 5h16v11H9l-4 3v-3H4z')],
  sparkle: [p('M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6')],
  photo: [r(3.5, 4.5, 17, 15, 3), c(9, 10, 1.8), p('m4 17.5 5-4.5 4 3 3-2 4.5 3.5')],
  grid: [r(3.5, 3.5, 7, 7, 2), r(13.5, 3.5, 7, 7, 2), r(3.5, 13.5, 7, 7, 2), r(13.5, 13.5, 7, 7, 2)],
  fingerprint: [
    p('M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4'),
    p('M14 13.12c0 2.38 0 6.38-1 8.88'),
    p('M17.29 21.02c.12-.6.43-2.3.5-3.02'),
    p('M2 12a10 10 0 0 1 18-6'),
    p('M21.8 16c.2-2 .131-5.354 0-6'),
    p('M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2'),
    p('M8.65 22c.21-.66.45-1.32.57-2'),
    p('M9 6.8a6 6 0 0 1 9 5.2v2'),
  ],
  bell: [p('M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9'), p('M13.7 21a2 2 0 0 1-3.4 0')],
  heart: [p('M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z')],
  comment: [p('M4 5h16v11H9l-4 3v-3H4z')],
  mail: [r(3, 5, 18, 14, 3), p('m4 7 8 6 8-6')],
  send: [p('M4 12 20 4l-6 16-3-7z')],
} satisfies Record<string, IconShape[]>;

export type IconName = keyof typeof icons;
