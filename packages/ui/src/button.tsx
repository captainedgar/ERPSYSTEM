import type { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export function Button({
  className = '',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      'bg-emerald-500 text-slate-950 hover:bg-emerald-400 focus-visible:ring-emerald-400',
    secondary:
      'border border-white/15 bg-white/5 text-white hover:bg-white/10 focus-visible:ring-white/40',
  };

  return (
    <button
      className={`inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
      type={type}
      {...props}
    />
  );
}
