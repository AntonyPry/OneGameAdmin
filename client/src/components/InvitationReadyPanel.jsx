import React from 'react';
import { Copy, Eye, EyeOff, KeyRound, Mail, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const InvitationReadyPanel = ({
  password,
  error,
  isVisible,
  onCopy,
  onRegenerate,
  onToggleVisible,
}) => {
  const VisibilityIcon = isVisible ? EyeOff : Eye;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3 md:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-2">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 text-sm">
            <div className="font-medium">Email-приглашение</div>
            <div className="text-muted-foreground">
              Backend-инвайты ожидают подключения; доступ создается с
              одноразовым fallback.
            </div>
          </div>
        </div>
        <Badge variant="secondary" className="w-fit shrink-0">
          Invitation-ready
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onCopy}>
          <Copy className="h-4 w-4" />
          Скопировать доступ
        </Button>
        <Button type="button" variant="outline" onClick={onToggleVisible}>
          <VisibilityIcon className="h-4 w-4" />
          {isVisible ? 'Скрыть fallback' : 'Показать fallback'}
        </Button>
        {isVisible && (
          <Button type="button" variant="ghost" onClick={onRegenerate}>
            <RefreshCw className="h-4 w-4" />
            Новый fallback
          </Button>
        )}
      </div>

      {isVisible && (
        <div className="relative min-w-0">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            readOnly
            value={password}
            className="pl-9 font-mono"
            aria-invalid={Boolean(error)}
          />
        </div>
      )}

      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
};

export default InvitationReadyPanel;
