'use client';

import { useEffect, useRef } from 'react';

// Cloudflare Turnstile for the waitlist forms (INV-12). It renders inside the form, where it adds the
// cf-turnstile-response field the server checks. "interaction-only" keeps it invisible unless Cloudflare needs
// the visitor to click. Rendered explicitly on mount, so it also works after an in-site navigation.

type Api = {
  render: (el: HTMLElement, options: Record<string, string>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Api;
  }
}

let loading: Promise<Api> | null = null;

function load(): Promise<Api> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')));
    script.onerror = () => {
      loading = null;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export function Turnstile({ siteKey }: { siteKey: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id: string | undefined;
    let gone = false;
    load()
      .then((api) => {
        if (gone || !box.current) return;
        id = api.render(box.current, { sitekey: siteKey, appearance: 'interaction-only', action: 'waitlist' });
      })
      .catch(() => {
        /* Without the widget there is no token, and the server answers with the captcha page. */
      });
    return () => {
      gone = true;
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey]);
  return <div ref={box} className="mk-captcha" />;
}
