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
    primary:
      'bg-blue-600 text-white shadow-sm shadow-blue-600/10 hover:bg-blue-700',
    secondary:
      'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50',
  };

  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      type={type}
      {...props}
    />
  );
}
