import { useTranslation } from 'react-i18next';

import { RadioRow } from '@/components/RadioRow';

import { VISIBILITIES, type Visibility } from './publishJar';

const VISIBILITY_KEY = { readers: 'readers', everyone: 'everyone', only_me: 'onlyMe' } as const;

export type VisibilityOptionsProps = {
  visibility: Visibility;
  /** Null while unknown: the Readers row then leaves the count out. */
  readerCount: number | null;
  onChange: (visibility: Visibility) => void;
  disabled?: boolean;
  /** Rows get `<prefix>-<visibility>` test ids. */
  testIDPrefix: string;
};

/** Readers, Everyone and Only me as radio rows (FR-PUB-03): Publish review and the jar's visibility menu. */
export function VisibilityOptions({
  visibility,
  readerCount,
  onChange,
  disabled,
  testIDPrefix,
}: VisibilityOptionsProps) {
  const { t } = useTranslation();
  return VISIBILITIES.map((option, i) => {
    const key = VISIBILITY_KEY[option];
    return (
      <RadioRow
        key={option}
        label={t(`publish.${key}`)}
        description={
          option === 'readers'
            ? readerCount === null
              ? t('publish.readersBodyUnknown')
              : t('publish.readersBody', { count: readerCount })
            : t(`publish.${key}Body`)
        }
        selected={visibility === option}
        onSelect={() => {
          if (!disabled) onChange(option);
        }}
        divider={i < VISIBILITIES.length - 1}
        testID={`${testIDPrefix}-${option}`}
      />
    );
  });
}
