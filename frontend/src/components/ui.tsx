import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export function Card({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cx(
        'rounded-[20px] bg-white border border-line',
        onClick && 'cursor-pointer active:scale-[0.99] transition-transform',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'gold' | 'danger';
}) {
  const styles = {
    primary: 'bg-green text-white',
    gold: 'bg-gold text-green-deep',
    ghost: 'bg-mist text-green',
    danger: 'bg-danger text-white',
  }[variant];
  return (
    <button
      {...rest}
      className={cx(
        'w-full rounded-2xl py-3.5 font-semibold text-[15px] disabled:opacity-50 active:scale-[0.99] transition',
        styles,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[13px] font-bold tracking-wide uppercase text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function IconTile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'w-11 h-11 rounded-[14px] grid place-items-center flex-none',
        className ?? 'bg-mist',
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'green' | 'gold' | 'success' | 'danger';
}) {
  const styles = {
    neutral: 'bg-mist text-muted',
    green: 'bg-green text-white',
    gold: 'bg-gold-soft text-[#8a6d1f]',
    success: 'bg-[#e8efe9] text-success',
    danger: 'bg-[#f7e6e3] text-danger',
  }[tone];
  return (
    <span className={cx('inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold', styles)}>
      {children}
    </span>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="w-6 h-6 rounded-full border-2 border-line border-t-green animate-spin" />
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="text-center text-muted text-sm py-10">{children}</div>;
}
