'use client';

import { useState } from 'react';

import { colors, radius } from '@/theme/tokens';

import { t } from '~/i18n/t';

/**
 * The item's photo, blurred until the moderator presses Show photo (FR-MOD-03). Each item starts blurred
 * again: the panel is keyed by item, so this state never carries over.
 */
export function BlurredPhoto({ url, label }: { url: string | null; label: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: radius.thumbLg,
        overflow: 'hidden',
        background: colors.photoPlaceholder,
        aspectRatio: '3 / 2',
      }}
    >
      {url ? (
        <img
          src={url}
          alt={shown ? label : t('detail.blurred')}
          data-blurred={shown ? 'false' : 'true'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: shown ? 'none' : 'blur(16px)',
            transform: shown ? 'none' : 'scale(1.1)',
          }}
        />
      ) : (
        <p style={{ margin: 0, padding: 24, color: colors.muted, textAlign: 'center' }}>{t('detail.noPhoto')}</p>
      )}
      {url ? (
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          style={{
            position: 'absolute',
            ...(shown ? { right: 12, bottom: 12 } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }),
            border: 'none',
            borderRadius: radius.pill,
            padding: '9px 14px',
            minHeight: 44,
            background: colors.surface,
            color: colors.ink,
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {shown ? t('detail.hide') : t('detail.show')}
        </button>
      ) : null}
    </div>
  );
}
