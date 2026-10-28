import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  className?: string;
  /** Focus the dialog itself on open, so no control shows a focus ring straight away. */
  focusContent?: boolean;
}

export function Dialog({ open, onOpenChange, title, description, children, footer, wide, className, focusContent }: DialogProps) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="dialog-overlay" />
        <RD.Content
          className={`dialog${wide ? ' dialog-wide' : ''}${className ? ` ${className}` : ''}`}
          onOpenAutoFocus={
            focusContent
              ? (e) => {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).focus();
                }
              : undefined
          }
        >
          <header className="dialog-header">
            <RD.Title className="dialog-title">{title}</RD.Title>
            <RD.Close className="icon-btn" aria-label="Close">
              <X size={18} />
            </RD.Close>
          </header>
          {description ? (
            <RD.Description className="dialog-description">{description}</RD.Description>
          ) : (
            <RD.Description className="sr-only">{title}</RD.Description>
          )}
          <div className="dialog-body">
            <ErrorBoundary name={title}>{children}</ErrorBoundary>
          </div>
          {footer && <footer className="dialog-footer">{footer}</footer>}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Promise-based confirmation, rendered with the app's own dialog. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    resolver.current?.(false);
    setOpts(o);
    return new Promise((resolve) => (resolver.current = resolve));
  }, []);

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={!!opts}
        onOpenChange={(o) => !o && close(false)}
        title={opts?.title ?? ''}
        description={opts?.description}
        footer={
          <>
            <button className="btn" onClick={() => close(false)}>
              Cancel
            </button>
            <button className={`btn ${opts?.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>
              {opts?.confirmLabel ?? 'OK'}
            </button>
          </>
        }
      >
        {null}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) throw new Error('useConfirm needs a ConfirmProvider');
  return fn;
}
