import React from 'react';

export default function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`animate-pulse bg-hover/80 rounded-ctl ${className}`}
      {...props}
    />
  );
}
