import Image from 'next/image';

import { toApiAssetUrl } from '@/lib/api';

type LogoSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<LogoSize, string> = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-16 w-16 text-lg',
  lg: 'h-24 w-24 text-2xl',
};

export function CompanyLogo({
  logoUrl,
  name,
  size = 'md',
}: {
  logoUrl?: string | null;
  name: string;
  size?: LogoSize;
}) {
  const assetUrl = toApiAssetUrl(logoUrl);

  return (
    <div
      className={`${sizeClasses[size]} relative grid shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-white font-bold text-blue-700 shadow-sm`}
    >
      {assetUrl ? (
        <Image
          alt={`Logo de ${name}`}
          className="object-contain p-1.5"
          fill
          sizes={size === 'lg' ? '96px' : size === 'md' ? '64px' : '40px'}
          src={assetUrl}
          unoptimized
        />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join('') || 'CE';
}
