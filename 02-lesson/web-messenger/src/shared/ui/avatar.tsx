import type { HTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export function Avatar({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('ui-avatar', className)} {...props} />;
}

export function AvatarFallback({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('ui-avatar-fallback', className)} {...props} />;
}
