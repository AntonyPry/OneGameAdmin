import { Info } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const InfoHint = ({ children, label = 'Пояснение', className }) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={cn(
          'inline-flex text-muted-foreground hover:text-foreground',
          className,
        )}
        aria-label={label}
      >
        <Info className="h-3.5 w-3.5" />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      className="max-w-[calc(100vw-2rem)] text-xs leading-relaxed"
    >
      {children}
    </PopoverContent>
  </Popover>
);

export { InfoHint };
