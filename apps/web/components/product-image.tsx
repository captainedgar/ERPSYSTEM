'use client';

import { useState } from 'react';

import { mediaUrl } from '@/lib/media';

export function ProductImage({
  imageUrl,
  name,
  className = 'h-14 w-14',
}: {
  imageUrl?: string | null;
  name: string;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const source = failedUrl === imageUrl ? null : mediaUrl(imageUrl);
  if (!source)
    return (
      <div
        aria-label={`${name} sin imagen`}
        className={`${className} grid shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-200 text-sm font-semibold text-slate-500`}
      >
        {initials(name)}
      </div>
    );
  return (
    // External URLs are user-configurable, so next/image host allowlists do not apply.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={name}
      className={`${className} shrink-0 rounded-xl bg-slate-100 object-cover`}
      loading="lazy"
      onError={() => setFailedUrl(imageUrl ?? null)}
      src={source}
    />
  );
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'P'
  );
}
