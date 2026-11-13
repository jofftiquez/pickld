import { colors } from '@/theme/tokens';

/** The Pickld mark (the tilted frame from the wordmark), shown beside "Pickld Mod" (design: ModConsole). */
export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden height={size} width={(size * 202) / 243} viewBox="29 12 202 243">
      <path
        fill={colors.brand}
        fillRule="evenodd"
        d="M205.5 12.0 L29.0 36.2 L60.2 254.8 L96.8 233.5 L100.8 205.2 L103.2 201.8 L230.8 184.5ZM186.5 37.8 L203.0 150.5 L71.2 169.0 L54.8 56.2Z"
      />
    </svg>
  );
}
