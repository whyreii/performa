import React from 'react';
import { Loader2 } from '../icons';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className = '',
  type = 'button',
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-full transition duration-performa focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none select-none';

  const variants = {
    primary:
      'bg-accent text-accent-foreground hover:brightness-110 active:brightness-95',
    secondary:
      'bg-transparent text-ink-2 border border-glass-line hover:bg-hover hover:text-ink',
    subtle:
      'bg-hover text-ink hover:bg-hover/80 border border-transparent',
    ghost:
      'bg-transparent text-ink-2 hover:text-ink hover:bg-hover',
    danger:
      'bg-bad/10 text-bad border border-bad/20 hover:bg-bad hover:text-white',
  };

  const sizes = {
    sm: 'h-7 px-2.5 text-12 gap-1.5',
    md: 'h-8 px-3 text-12 gap-1.5',
    lg: 'h-10 px-4 text-14 gap-2',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
      ) : (
        LeftIcon && <LeftIcon className="w-3.5 h-3.5 shrink-0" />
      )}
      {children}
      {!isLoading && RightIcon && <RightIcon className="w-3.5 h-3.5 shrink-0" />}
    </button>
  );
}
