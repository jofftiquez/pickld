'use client';

import type { CSSProperties, ReactNode } from 'react';

/**
 * A store link that copies the invite code first (INV-05; design: WebInvite), so Paste at Sign up finds it
 * after the install. No paid deep-link service. Without JavaScript, or if the copy is refused, it is still
 * the store link.
 */
export function CopyAndOpen({
  code,
  href,
  style,
  children,
}: {
  code: string;
  href: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      style={style}
      onClick={async (event) => {
        event.preventDefault();
        try {
          await navigator.clipboard.writeText(code);
        } catch {
          // Copy refused: the code is on the page to type in.
        }
        window.location.href = href;
      }}
    >
      {children}
    </a>
  );
}
