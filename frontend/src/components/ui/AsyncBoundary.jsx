import React from 'react';
import { AlertTriangle } from '../icons';
import Button from './Button';
import Skeleton from './Skeleton';
import { getApiErrorMessage } from '../../api';

// One consistent loading / error+retry / empty treatment for page-level queries,
// so a failed fetch is never rendered as "no data" (which, on an evidentiary
// screen, would read as "no record exists").
export default function AsyncBoundary({
  isLoading = false,
  isError = false,
  error,
  onRetry,
  isEmpty = false,
  empty = null,
  skeleton = null,
  errorMessage = 'Failed to load this section.',
  children,
}) {
  if (isLoading) {
    return skeleton ?? <Skeleton className="h-24 w-full" />;
  }
  if (isError) {
    return (
      <div className="py-10 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 mx-auto text-bad" />
        <p className="text-12 text-bad">{getApiErrorMessage(error, errorMessage)}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={() => onRetry()}>
            Retry
          </Button>
        )}
      </div>
    );
  }
  if (isEmpty) {
    return empty;
  }
  return children;
}
