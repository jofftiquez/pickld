import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

type Props = { id: string; title: string; children: ReactNode };

/** One labelled block of the dev gallery; `id` is the testID Maestro scrolls to. */
export function GallerySection({ id, title, children }: Props) {
  return (
    <View testID={`gallery-${id}`} style={{ gap: space.md, paddingVertical: space.lg }}>
      <Text accessibilityRole="header" style={[textStyle('sectionTitle'), { color: colors.ink }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}
