import React from 'react';

// Minimal-system worklist row (docs/LAYOUT_GRAMMAR.md): a hairline-separated
// 80px row laid out on the section's ten content tracks. Place its parts with
// <Col span={n}> from PageGrid; below lg the row stacks with 16px padding.
export function ListHead({ children, className = '' }) {
  return (
    <div
      className={`hidden lg:grid lg:grid-cols-10 lg:gap-x-6 h-8 items-end pb-1.5 text-12 text-ink-3${
        className ? ` ${className}` : ''
      }`}
    >
      {children}
    </div>
  );
}

export default function ListRow({ children, className = '', ...props }) {
  return (
    <div
      className={`py-4 lg:py-0 lg:min-h-20 lg:grid lg:grid-cols-10 lg:gap-x-6 lg:items-center border-t border-line transition-colors duration-performa hover:bg-hover${
        className ? ` ${className}` : ''
      }`}
      {...props}
    >
      {children}
    </div>
  );
}
