'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';

/**
 * A photo with what sits on it (stickers, text), shown only once the photo has loaded: over the grey box
 * they would look like they float. A photo the browser loaded before the page came alive fires no load
 * event React sees, so the ref also checks whether it is already complete.
 */
export function LoadedPhoto({
  src,
  alt,
  style,
  children,
}: {
  src: string;
  alt: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <img
        ref={(img) => {
          if (img?.complete && img.naturalWidth > 0) setLoaded(true);
        }}
        src={src}
        alt={alt}
        style={style}
        onLoad={() => setLoaded(true)}
      />
      <div data-overlays style={{ position: 'absolute', inset: 0, opacity: loaded ? 1 : 0 }}>
        {children}
      </div>
    </>
  );
}
