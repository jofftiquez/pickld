import Image, { type StaticImageData } from 'next/image';

/** An app screenshot in a simple phone outline. `sizes` tells next/image how wide it shows. */
export function Phone({
  src,
  alt,
  sizes,
  preload = false,
  className = '',
}: {
  src: StaticImageData;
  alt: string;
  sizes: string;
  preload?: boolean;
  className?: string;
}) {
  return (
    <div className={`mk-phone ${className}`}>
      <Image src={src} alt={alt} sizes={sizes} preload={preload} placeholder="blur" quality={80} />
    </div>
  );
}
