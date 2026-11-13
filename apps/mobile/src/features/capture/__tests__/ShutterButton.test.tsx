import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { colors } from '@/theme/tokens';

import { ShutterButton } from '../ShutterButton';

describe('ShutterButton', () => {
  it('is a brand-green disc inside the white ring (QA item 26)', async () => {
    await render(<ShutterButton accessibilityLabel="Take photo" onPress={() => {}} />);
    const ring = StyleSheet.flatten(screen.getByTestId('camera-shutter').props.style);
    const disc = StyleSheet.flatten(screen.getByTestId('camera-shutter-disc').props.style);
    expect(ring.borderColor).toBe(colors.surface);
    expect(disc.backgroundColor).toBe(colors.brand);
  });
});
