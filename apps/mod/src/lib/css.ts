import { colors, radius } from '@/theme/tokens';

/**
 * The few rules inline styles can't express (hover, sticky headers, a link that covers its row, the loading
 * shimmer), built from the theme tokens and rendered once by the root layout.
 */
export const globalCss = `
a{color:${colors.brandLink}}
button{font:inherit;cursor:pointer}
.dt{width:100%;border-collapse:separate;border-spacing:0;font-size:14px}
.dt thead th{position:sticky;top:0;z-index:2;background:${colors.surface};box-shadow:inset 0 -1px 0 ${colors.divider};
  padding:11px 14px;font-size:12px;font-weight:700;color:${colors.muted};white-space:nowrap;text-align:left}
.dt thead th[data-align=right]{text-align:right}
.dt tbody th,.dt tbody td{padding:10px 14px;border-bottom:1px solid ${colors.divider};text-align:left;vertical-align:middle;font-weight:500}
.dt tbody th{font-weight:700}
.dt tbody [data-align=right]{text-align:right}
.dt tbody tr:last-child>*{border-bottom:none}
.dt tbody tr{position:relative}
.dt tbody tr[data-link]:hover{background:${colors.subtle}}
.dt tbody tr[data-selected]{background:${colors.rowSelected}}
.dt .row-link{color:inherit;text-decoration:none}
.dt .row-link::after{content:'';position:absolute;inset:0}
.dt .row-link:focus-visible{outline:none}
.dt tbody tr:has(.row-link:focus-visible){outline:2px solid ${colors.brandLink};outline-offset:-2px}
.dt tbody td a:not(.row-link),.dt tbody th a:not(.row-link){position:relative;z-index:1}
.dt-sort{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:4px;color:inherit;text-decoration:none;
  min-height:24px;border-radius:${radius.thumb}px}
.dt-sort:hover{color:${colors.ink}}
.dt-sort:focus-visible{outline:2px solid ${colors.brandLink};outline-offset:2px}
.pg-link{display:inline-flex;align-items:center;justify-content:center;min-width:36px;min-height:36px;padding:0 10px;
  box-sizing:border-box;border-radius:${radius.pill}px;border:1px solid ${colors.divider};background:${colors.surface};
  color:${colors.ink};font-size:13px;font-weight:700;text-decoration:none;position:relative}
.pg-link::before{content:'';position:absolute;inset:-4px}
.pg-link:hover{border-color:${colors.border};background:${colors.subtle}}
.pg-link[aria-current=page]{background:${colors.ink};border-color:${colors.ink};color:${colors.surface}}
.pg-link[aria-disabled=true]{color:${colors.chevron};background:${colors.surface};cursor:default;pointer-events:none}
.skeleton{background:${colors.divider};border-radius:${radius.thumb}px;animation:pulse 1.2s ease-in-out infinite}
@keyframes pulse{50%{opacity:.45}}
@media (prefers-reduced-motion: reduce){.skeleton{animation:none}}
`;
