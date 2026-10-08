import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export const ScrollArea = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div className={cn('ui-scroll-area', className)} ref={ref} {...props} />,
);

ScrollArea.displayName = 'ScrollArea';
