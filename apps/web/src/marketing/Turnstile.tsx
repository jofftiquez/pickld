'use client';

import { useEffect, useRef, useState } from 'react';

// Cloudflare Turnstile for the waitlist forms (INV-12). It renders inside the form, where it adds the
// cf-turnstile-response field the server checks. "interaction-only" keeps it invisible unless Cloudflare needs
// the visitor to click. Rendered explicitly on mount, so it also works after an in-site navigation.
//
// The token takes a few seconds to arrive, and each one is good for a single check. So a submit before the
// token waits for it and then goes on by itself, and every submit that carries a token gets the widget a new one.

type Api = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  getResponse: (id: string) => string | undefined;
  isExpired: (id: string) => boolean;
  reset: (id: string) => void;
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

export function Turnstile({ siteKey, checking }: { siteKey: string; checking: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    const form = box.current?.closest('form');
    let id: string | undefined;
    let gone = false;
    let held = false;
    // The token arrived, or the widget failed (the server then answers with the captcha page): send the held submit.
    const release = () => {
      if (!held) return;
      held = false;
      setWaiting(false);
      form?.requestSubmit();
    };
    // Capture phase on the form, so it runs before React starts the server action.
    const onSubmit = (event: SubmitEvent) => {
      const api = window.turnstile;
      if (!api || id === undefined) return; // no widget: nothing to wait for
      if (api.getResponse(id) && !api.isExpired(id)) {
        // React has read the form by now; the next submit needs a token of its own.
        const sent = id;
        setTimeout(() => {
          if (!gone) api.reset(sent);
        });
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      held = true;
      setWaiting(true);
    };
    form?.addEventListener('submit', onSubmit, true);
    load()
      .then((api) => {
        if (gone || !box.current) return;
        id = api.render(box.current, {
          sitekey: siteKey,
          appearance: 'interaction-only',
          action: 'waitlist',
          callback: release,
          'error-callback': release,
        });
      })
      .catch(() => {
        /* Without the widget there is no token, and the server answers with the captcha page. */
      });
    return () => {
      gone = true;
      form?.removeEventListener('submit', onSubmit, true);
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey]);
  return (
    <>
      <div ref={box} className="mk-captcha" />
      <p className={waiting ? 'mk-form-note' : 'mk-sr'} role="status">
        {waiting ? checking : ''}
      </p>
    </>
  );
}
