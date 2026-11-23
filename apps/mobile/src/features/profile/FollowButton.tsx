import { useTranslation } from 'react-i18next';

import { PillButton } from '@/components/PillButton';

import type { FollowAction } from './profileModel';

export type FollowButtonProps = {
  action: FollowAction;
  /** Whose name the screen reader hears with the button, e.g. "Mika Reyes". */
  name: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/** Be a reader / Read back (brand green), Reading (subtle; tapping it stops reading) and Requested (subtle; tapping
 * it cancels the request, 0176). Copy per D-7, D-86.
 * The pill grows with its label and wraps to a second line rather than clipping at large text. */
export function FollowButton({ action, name, onPress, disabled, testID }: FollowButtonProps) {
  const { t } = useTranslation();
  return (
    <PillButton
      variant={action === 'reading' || action === 'requested' ? 'subtle' : 'primary'}
      label={t(`follow.${action}`)}
      accessibilityLabel={t(`follow.${action}A11y`, { name })}
      accessibilityHint={t(`follow.${action}Hint`)}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
    />
  );
}
