import React, { createContext, useCallback, useContext, useEffect, useId, useState } from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Info,
  LoaderCircle,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { cn, copyText, initials } from './lib';

const buttonVariants = {
  primary:
    'bg-primary text-primary-foreground shadow-[0_10px_28px_-16px_hsl(var(--primary)/0.85)] hover:bg-primary/90 active:scale-[0.98]',
  secondary:
    'border border-border bg-secondary text-secondary-foreground hover:border-border hover:bg-muted active:scale-[0.98]',
  outline:
    'border border-border bg-transparent text-foreground hover:bg-muted active:scale-[0.98]',
  ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  soft: 'border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20',
  danger:
    'bg-destructive text-destructive-foreground shadow-[0_10px_28px_-16px_hsl(var(--destructive)/0.9)] hover:bg-destructive/90 active:scale-[0.98]',
  dangerSoft:
    'border border-destructive/25 bg-destructive/10 text-[hsl(350_90%_72%)] hover:bg-destructive/20',
};

const buttonSizes = {
  sm: 'h-8 gap-1.5 px-3 text-[13px]',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-5 text-sm',
  icon: 'h-10 w-10 p-0',
  iconSm: 'h-8 w-8 p-0',
};

export const Button = React.forwardRef(function Button(
  { className, variant = 'primary', size = 'md', busy, children, type = 'button', disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-semibold transition-[background-color,color,border-color,transform,box-shadow,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});

export function IconButton({ label, className, variant = 'ghost', size = 'icon', children, ...props }) {
  return (
    <Button aria-label={label} title={label} variant={variant} size={size} className={className} {...props}>
      {children}
    </Button>
  );
}

export function Card({ className, interactive = false, ...props }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card text-card-foreground shadow-panel',
        interactive && 'transition-[border-color,background-color,transform] duration-200 hover:border-foreground/20',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ eyebrow, title, description, action, className, children }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-border px-5 py-4', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h3>
        {description && <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{description}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SectionLabel({ children, className }) {
  return (
    <div className={cn('font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80', className)}>
      {children}
    </div>
  );
}

const badgeTones = {
  neutral: 'border-border bg-muted/70 text-muted-foreground',
  good: 'border-success/25 bg-success/10 text-success',
  warn: 'border-warning/25 bg-warning/10 text-warning',
  bad: 'border-destructive/25 bg-destructive/10 text-[hsl(350_90%_72%)]',
  info: 'border-info/25 bg-info/10 text-info',
  primary: 'border-primary/25 bg-primary/10 text-primary',
};

export function Badge({ children, tone = 'neutral', dot = false, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5',
        badgeTones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

const dotTones = {
  good: 'bg-success',
  warn: 'bg-warning',
  bad: 'bg-[hsl(350_80%_58%)]',
  neutral: 'bg-muted-foreground/60',
  primary: 'bg-primary',
};

export function StatusDot({ tone = 'good', pulse = false, className }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        dotTones[tone],
        pulse && 'animate-pulse-ring',
        className,
      )}
      aria-hidden="true"
    />
  );
}

const controlClasses =
  'w-full rounded-lg border border-input bg-input/70 px-3 text-sm text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.03)] outline-none transition-colors placeholder:text-muted-foreground/60 hover:border-muted-foreground/30 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive/60';

export const Input = React.forwardRef(function Input({ className, type = 'text', ...props }, ref) {
  return <input ref={ref} type={type} className={cn(controlClasses, 'h-10', className)} {...props} />;
});

export const Textarea = React.forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(controlClasses, 'min-h-24 resize-y py-2.5 leading-6', className)} {...props} />;
});

export const Select = React.forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        className={cn(controlClasses, 'h-10 appearance-none pr-9')}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
});

export function SearchField({ value, onChange, placeholder = 'Search', className, onClear }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pl-9 pr-9"
        type="search"
        aria-label={placeholder}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={onClear || (() => onChange({ target: { value: '' } }))}
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function Field({ label, hint, error, children, className, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className={cn('grid gap-1.5 text-[13px] font-medium text-secondary-foreground', className)}>
      <span>{label}</span>
      {children}
      {hint && <span className="text-[11.5px] font-normal leading-4 text-muted-foreground">{hint}</span>}
      {error && <span className="text-[11.5px] font-medium leading-4 text-[hsl(350_90%_72%)]">{error}</span>}
    </label>
  );
}

export function Switch({ checked, onCheckedChange, disabled, className, label }) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full border border-border bg-muted transition-colors data-[state=checked]:border-primary/60 data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
    >
      <SwitchPrimitive.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-secondary-foreground shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-primary-foreground" />
    </SwitchPrimitive.Root>
  );
}

export function SwitchRow({ checked, onCheckedChange, label, description, disabled, className, badge }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-4', className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          {badge}
        </div>
        {description && <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} label={label} />
    </div>
  );
}

const modalSizes = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md', className }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[3px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[86dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-lift outline-none',
            modalSizes[size],
            className,
          )}
        >
          <div className="animate-fade-up">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <DialogPrimitive.Title className="font-display text-lg font-semibold tracking-tight text-foreground">
                  {title}
                </DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description className="mt-1 text-[13px] leading-5 text-muted-foreground">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close asChild>
                <IconButton label="Close dialog" variant="ghost" size="iconSm">
                  <X className="h-4 w-4" />
                </IconButton>
              </DialogPrimitive.Close>
            </div>
            <div className="max-h-[calc(86dvh-9.5rem)] overflow-y-auto p-5 scrollbar-thin">{children}</div>
            {footer && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/30 px-5 py-3.5">
                {footer}
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy,
  onConfirm,
  children,
}) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[3px] data-[state=open]:animate-fade-in" />
        <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 shadow-lift outline-none">
          <div className="animate-fade-up">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-lg',
                  tone === 'danger' ? 'bg-destructive/10 text-[hsl(350_90%_72%)]' : 'bg-primary/10 text-primary',
                )}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <AlertDialogPrimitive.Title className="font-display text-lg font-semibold tracking-tight text-foreground">
                  {title}
                </AlertDialogPrimitive.Title>
                {description && (
                  <AlertDialogPrimitive.Description className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
                    {description}
                  </AlertDialogPrimitive.Description>
                )}
              </div>
            </div>
            {children && <div className="mt-4">{children}</div>}
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialogPrimitive.Cancel asChild>
                <Button variant="secondary" disabled={busy}>
                  {cancelLabel}
                </Button>
              </AlertDialogPrimitive.Cancel>
              <AlertDialogPrimitive.Action asChild>
                <Button
                  variant={tone === 'danger' ? 'danger' : 'primary'}
                  busy={busy}
                  onClick={(event) => {
                    event.preventDefault();
                    onConfirm?.();
                  }}
                >
                  {confirmLabel}
                </Button>
              </AlertDialogPrimitive.Action>
            </div>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

const ToastContext = createContext(null);

const toastTones = {
  good: {
    icon: CheckCircle2,
    className: 'border-success/25 bg-card',
    iconClass: 'text-success',
  },
  bad: {
    icon: XCircle,
    className: 'border-destructive/30 bg-card',
    iconClass: 'text-[hsl(350_90%_72%)]',
  },
  warn: {
    icon: AlertTriangle,
    className: 'border-warning/25 bg-card',
    iconClass: 'text-warning',
  },
  info: {
    icon: Info,
    className: 'border-info/25 bg-card',
    iconClass: 'text-info',
  },
};

function ToastItem({ toast, onDismiss }) {
  const tone = toastTones[toast.tone] || toastTones.good;
  const Icon = tone.icon;
  useEffect(() => {
    if (!toast.duration) return undefined;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role={toast.tone === 'bad' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lift backdrop-blur-md animate-toast-in',
        tone.className,
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', tone.iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {toast.title && <div className="text-[13px] font-semibold text-foreground">{toast.title}</div>}
        <div className={cn('text-[12.5px] leading-5 text-muted-foreground', toast.title && 'mt-0.5')}>
          {toast.message}
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback((message, options = {}) => {
    const id = Math.random().toString(36).slice(2);
    const tone = options.tone || 'good';
    setToasts((list) => [
      ...list.slice(-3),
      {
        id,
        message: String(message),
        title: options.title,
        tone,
        duration: options.duration ?? (tone === 'bad' ? 6500 : 4200),
      },
    ]);
    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="toast-viewport" role="region" aria-label="Notifications">
        {toasts.map((item) => (
          <ToastItem key={item.id} toast={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}

export function PageHeader({ eyebrow, icon: Icon, title, description, actions, meta }) {
  return (
    <header className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/90">
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-[clamp(1.65rem,2.4vw,2.15rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-[13.5px] leading-6 text-muted-foreground">{description}</p>
        )}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Notice({ tone = 'info', message, action, className }) {
  if (!message) return null;
  const styles = {
    info: 'border-info/20 bg-info/10 text-info',
    good: 'border-success/20 bg-success/10 text-success',
    warn: 'border-warning/20 bg-warning/10 text-warning',
    bad: 'border-destructive/25 bg-destructive/10 text-[hsl(350_90%_72%)]',
  };
  const Icon = tone === 'good' ? CheckCircle2 : tone === 'bad' ? XCircle : tone === 'warn' ? AlertTriangle : Info;
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[12.5px] leading-5', styles[tone], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{message}</div>
      {action}
    </div>
  );
}

export function Empty({ icon: Icon, title, description, action }) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl border border-border bg-muted/60 text-muted-foreground">
        {Icon ? <Icon className="h-5 w-5" /> : <Info className="h-5 w-5" />}
      </div>
      <h4 className="font-display text-[15px] font-semibold text-foreground">{title}</h4>
      {description && <p className="mt-1 max-w-sm text-[12.5px] leading-5 text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-lg bg-muted/70', className)} />;
}

export function Spinner({ className }) {
  return <LoaderCircle className={cn('h-4 w-4 animate-spin', className)} aria-hidden="true" />;
}

export function Avatar({ name, src, size = 'md', className, alt }) {
  const [failed, setFailed] = useState(false);
  const sizes = {
    sm: 'h-8 w-8 text-[10px]',
    md: 'h-9 w-9 text-[11px]',
    lg: 'h-12 w-12 text-sm',
    xl: 'h-14 w-14 text-base',
  };
  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-[linear-gradient(145deg,hsl(var(--muted)),hsl(var(--secondary)))] font-mono font-semibold text-secondary-foreground',
        sizes[size],
        className,
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={alt || name || ''}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden={!name}>{initials(name)}</span>
      )}
    </span>
  );
}

export function Sparkline({ values = [], tone = 'ember', height = 36, className }) {
  const id = useId().replace(/:/g, '');
  const numeric = values.map((value) => Number(value) || 0);
  const max = Math.max(...numeric, 1);
  const min = Math.min(...numeric, 0);
  const span = Math.max(max - min, 1);
  const width = 132;
  const step = numeric.length > 1 ? width / (numeric.length - 1) : width;
  const points = numeric.map((value, index) => {
    const x = index * step;
    const y = height - 4 - ((value - min) / span) * (height - 8);
    return [x, y];
  });
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = points.length
    ? `M0,${height} L${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')} L${width},${height} Z`
    : '';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn(
        'h-9 w-full',
        tone === 'jade' ? 'text-success' : tone === 'amber' ? 'text-warning' : 'text-primary',
        className,
      )}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={area} fill={`url(#spark-${id})`} />}
      {line && (
        <polyline
          points={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

export function CopyButton({ value, label = 'Copy value', className, onCopied }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function handleCopy() {
    try {
      await copyText(value);
      setCopied(true);
      onCopied?.();
      toast('Copied to clipboard.', { tone: 'info', duration: 2400 });
      setTimeout(() => setCopied(false), 1600);
    } catch (cause) {
      toast(cause.message, { tone: 'bad' });
    }
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={handleCopy}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, children }) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-secondary/50 p-1 no-scrollbar sm:w-auto',
        className,
      )}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({ value, children, className, count }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        'inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3.5 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:flex-none',
        className,
      )}
    >
      {children}
      {count != null && (
        <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
          {count}
        </span>
      )}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ value, children, className }) {
  return (
    <TabsPrimitive.Content value={value} className={cn('mt-5 outline-none', className)}>
      {children}
    </TabsPrimitive.Content>
  );
}

export function Segmented({ value, onChange, options, label, className }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/50 p-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
            {option.count != null && (
              <span className="font-mono text-[10px] text-muted-foreground">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBar({ value, tone = 'primary', className }) {
  const colors = {
    primary: 'bg-primary',
    good: 'bg-success',
    warn: 'bg-warning',
    bad: 'bg-destructive',
  };
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', colors[tone])}
        style={{ width: `${Math.max(0, Math.min(100, Number(value) || 0))}%` }}
      />
    </div>
  );
}

export function StatTile({ label, value, hint, icon: Icon, tone = 'primary', children, className }) {
  const toneClasses = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    good: 'bg-success/10 text-success border-success/20',
    warn: 'bg-warning/10 text-warning border-warning/20',
    neutral: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <Card className={cn('relative overflow-hidden p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 font-display text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-foreground tabular-nums">
            {value}
          </div>
          {hint && <div className="mt-2 text-[11.5px] leading-4 text-muted-foreground">{hint}</div>}
        </div>
        {Icon && (
          <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg border', toneClasses[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </Card>
  );
}
