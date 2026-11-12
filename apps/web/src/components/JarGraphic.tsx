import { colors, jar } from '@/theme/tokens';

/** The small jar on the dark Get the app card (design: WebShare), eight layers full. */
export function JarGraphic() {
  const layers = Array.from({ length: 8 }, (_, i) => i);
  return (
    <svg aria-hidden width={40} height={50} viewBox="0 0 48 60">
      <defs>
        <clipPath id="jar-web">
          <rect x={5} y={15} width={38} height={42} rx={10} />
        </clipPath>
      </defs>
      <rect x={5} y={15} width={38} height={42} rx={10} fill={jar.glassOnDark} />
      <g clipPath="url(#jar-web)">
        {layers.map((i) => (
          <rect key={i} x={6} y={51 - i * 5} width={36} height={5.3} fill={i % 2 ? colors.brandLayer : colors.brand} />
        ))}
      </g>
      <rect x={5} y={15} width={38} height={42} rx={10} fill="none" stroke={jar.strokeOnDark} strokeWidth={2} />
      <rect x={13} y={10} width={22} height={5} rx={1.5} fill="none" stroke={jar.strokeOnDark} strokeWidth={2} />
      <rect x={10} y={2} width={28} height={8} rx={3} fill={colors.brand} />
      <path d="M11 24v18" stroke={jar.highlight} strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}
