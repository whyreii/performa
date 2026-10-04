import React from 'react';
import Card from './Card';
import Skeleton from './Skeleton';

// Loading placeholder for an async Card. Renders through the real Card surface so
// the radius, border, background and padding always match the loaded card (and stay
// theme-correct). Pass row stubs as children to mirror a specific card's height;
// otherwise a generic three-row stub is used. Reserving the space here is what
// removes the layout shift when the data arrives.
export default function CardSkeleton({ className = '', children }) {
  return (
    <Card className={`animate-pulse ${className}`} aria-hidden="true">
      {children ?? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      )}
    </Card>
  );
}
