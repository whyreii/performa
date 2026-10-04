import React from 'react';
import Skeleton from './Skeleton';

// Content-area loading frame shown while a lazy route chunk loads. Lives inside
// AppShell so the sidebar/top bar stay put (the shell never flashes).
export default function PageSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-line">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
