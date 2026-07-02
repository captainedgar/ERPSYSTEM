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
  const styles = {
    primary: 'bg-emerald-500 text-slate-950 hover:bg-emerald-400',
    secondary:
      'border border-slate-700 bg-slate-900 text-white hover:bg-slate-800',
  };

  return (
    <button
      className={`inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition disabled:opacity-50 ${styles[variant]} ${className}`}
      type={type}
      {...props}
    />
  );
}
