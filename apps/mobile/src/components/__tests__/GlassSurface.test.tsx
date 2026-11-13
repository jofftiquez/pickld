import { act, render, screen } from '@testing-library/react-native';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { AccessibilityInfo, Text } from 'react-native';

import { GlassSurface } from '../GlassSurface';
import { colors, radius } from '@/theme/tokens';
import { flatStyle } from './testUtils';

const liquidGlass = jest.mocked(isLiquidGlassAvailable);
const glassApi = jest.mocked(isGlassEffectAPIAvailable);

/** Sets Reduce Transparency and returns a function that changes it, as iOS does from Settings. */
function reduceTransparency(enabled: boolean): (next: boolean) => void {
  let listener: ((next: boolean) => void) | undefined;
  jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(enabled);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((event, handler) => {
    if (event === 'reduceTransparencyChanged') listener = handler as (next: boolean) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>;
  });
  return (next) => listener?.(next);
}

async function renderSurface() {
  await render(
    <GlassSurface
      tone="dark"
      radius={radius.pill}
      tint={colors.glassStrong}
      fallbackColor={colors.glass}
      testID="surface"
    >
      <Text>Mia</Text>
    </GlassSurface>,
  );
  // Let the Reduce Transparency check settle.
  await act(async () => {});
}

describe('GlassSurface', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    liquidGlass.mockReturnValue(false);
    glassApi.mockReturnValue(false);
  });

  it('draws Liquid Glass with the token tint on iOS 26 when Reduce Transparency is off', async () => {
    liquidGlass.mockReturnValue(true);
    glassApi.mockReturnValue(true);
    reduceTransparency(false);
    await renderSurface();
    const surface = screen.getByTestId('surface');
    expect(surface.props).toMatchObject({
      glassEffectStyle: 'regular',
      tintColor: colors.glassStrong,
      colorScheme: 'dark',
    });
    expect(flatStyle(surface)).toMatchObject({ borderRadius: radius.pill, overflow: 'hidden' });
    expect(screen.queryByTestId('surface-blur')).toBeNull();
    expect(screen.getByText('Mia')).toBeTruthy();
  });

  it('keeps the blur look below iOS 26', async () => {
    reduceTransparency(false);
    await renderSurface();
    expect(screen.getByTestId('surface').props.glassEffectStyle).toBeUndefined();
    expect(flatStyle(screen.getByTestId('surface')).backgroundColor).toBe(colors.glass);
    expect(screen.getByTestId('surface-blur')).toBeTruthy();
  });

  it('keeps the blur look when iOS 26 lacks the glass API', async () => {
    liquidGlass.mockReturnValue(true);
    reduceTransparency(false);
    await renderSurface();
    expect(screen.getByTestId('surface-blur')).toBeTruthy();
  });

  it('keeps the blur look with Reduce Transparency on, and follows the setting when it changes', async () => {
    liquidGlass.mockReturnValue(true);
    glassApi.mockReturnValue(true);
    const change = reduceTransparency(true);
    await renderSurface();
    expect(screen.getByTestId('surface-blur')).toBeTruthy();

    await act(async () => change(false));
    expect(screen.getByTestId('surface').props.glassEffectStyle).toBe('regular');
    expect(screen.queryByTestId('surface-blur')).toBeNull();

    await act(async () => change(true));
    expect(screen.getByTestId('surface-blur')).toBeTruthy();
  });

  it('can fall back to a plain surface with no blur', async () => {
    await render(<GlassSurface tone="light" fallback="none" testID="surface" />);
    expect(screen.queryByTestId('surface-blur')).toBeNull();
    expect(flatStyle(screen.getByTestId('surface')).backgroundColor).toBeUndefined();
  });
});
