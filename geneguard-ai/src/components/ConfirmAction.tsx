import { useEffect, useRef, useState, type ReactNode } from 'react';

// In-page confirmation (browser confirm() dialogs are blocked in embedded views).
export function ConfirmAction({
  children,
  question,
  confirmLabel,
  onConfirm,
  className,
  disabled,
  align = 'left',
  title,
}: {
  children: ReactNode;
  question: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  className: string;
  disabled?: boolean;
  align?: 'left' | 'right';
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative inline-block">
      <button type="button" className={className} disabled={disabled} onClick={() => setOpen((o) => !o)} aria-expanded={open} title={title}>
        {children}
      </button>
      {open && (
        <div
          role="alertdialog"
          className={`card absolute z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] p-4 text-sm ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          <p className="text-ink">{question}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-danger py-1.5 text-xs"
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {confirmLabel}
            </button>
            <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
