import { colors, radius } from '@/theme/tokens';

/**
 * The theme tokens as the CSS variables shadcn/ui components read (globals.css maps them to Tailwind colors and
 * radii), so the tokens stay the one source of colors.
 */
export const themeCss = `:root{
--background:${colors.background};--foreground:${colors.ink};
--card:${colors.surface};--card-foreground:${colors.ink};
--popover:${colors.surface};--popover-foreground:${colors.ink};
--primary:${colors.brand};--primary-foreground:${colors.surface};
--secondary:${colors.subtle};--secondary-foreground:${colors.ink};
--muted:${colors.subtle};--muted-foreground:${colors.muted};
--accent:${colors.subtle};--accent-foreground:${colors.ink};
--destructive:${colors.danger};--destructive-tint:${colors.dangerTint};--destructive-text:${colors.likeText};
--border:${colors.divider};--input:${colors.border};--ring:${colors.brandLink};--link:${colors.brandLink};
--brand-tint:${colors.brandTint};--brand-text:${colors.brandText};--selected:${colors.rowSelected};
--sidebar:${colors.ink};--sidebar-foreground:${colors.surface};--sidebar-muted:${colors.onDarkMuted};
--sidebar-primary:${colors.brand};--sidebar-primary-foreground:${colors.ink};
--sidebar-accent:${colors.onDarkControl};--sidebar-accent-foreground:${colors.surface};
--sidebar-border:${colors.onDarkControl};--sidebar-ring:${colors.brand};
--radius:${radius.thumbLg}px;--r-card:${radius.card}px;--r-input:${radius.input}px;--r-tile:${radius.thumbLg}px}`;
