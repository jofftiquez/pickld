import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

import { icons, type IconName } from './icons';

export type IconProps = {
  name: IconName;
  /** A color token; icons never take raw colors. */
  color?: keyof typeof colors;
  size?: number;
  strokeWidth?: number;
  /** Fills the shape with its color too, e.g. a liked heart. */
  filled?: boolean;
};

/** Decorative stroke icon. Hidden from screen readers; the control around it carries the label. */
export function Icon({ name, color = 'ink', size = 22, strokeWidth = 1.8, filled = false }: IconProps) {
  const stroke = colors[color];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? stroke : 'none'}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID={`icon-${name}`}
    >
      {icons[name].map((shape, i) => {
        switch (shape.kind) {
          case 'path':
            return <Path key={i} d={shape.d} />;
          case 'circle':
            return <Circle key={i} cx={shape.cx} cy={shape.cy} r={shape.r} />;
          case 'rect':
            return <Rect key={i} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} />;
        }
      })}
    </Svg>
  );
}
