import type { ComponentPropsWithRef } from 'react';
import { cn } from '../lib/utils';

export function Input({ className, ...props }: ComponentPropsWithRef<'input'>) {
  return <input className={cn('ui-input', className)} {...props} />;
}
