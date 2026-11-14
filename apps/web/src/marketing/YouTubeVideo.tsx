'use client';

import Image, { type StaticImageData } from 'next/image';
import { useEffect, useRef, useState } from 'react';

/**
 * A YouTube video that costs nothing until it's played: a poster linking to YouTube (so it works without
 * JavaScript and with Cmd-click), swapped for the youtube-nocookie player on a plain click.
 */
export function YouTubeVideo({
  id,
  poster,
  label,
  title,
}: {
  id: string;
  poster: StaticImageData;
  /** Names the link: what plays and where. */
  label: string;
  /** Names the player once it loads. */
  title: string;
}) {
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (playing) frame.current?.focus();
  }, [playing]);

  if (playing) {
    return (
      <div className="mk-video">
        <iframe
          ref={frame}
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }
  return (
    <a
      className="mk-video"
      href={`https://www.youtube.com/watch?v=${id}`}
      aria-label={label}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        setPlaying(true);
      }}
    >
      <Image src={poster} alt="" sizes="(min-width: 1140px) 1080px, 92vw" placeholder="blur" />
      <span className="mk-play" aria-hidden="true" />
    </a>
  );
}
