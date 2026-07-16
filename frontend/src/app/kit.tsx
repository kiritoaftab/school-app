import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { GLYPH } from './data';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/** A single-path 24×24 icon, matching the prototype's icon style. */
export function Glyph({
  d,
  size = 20,
  stroke = 1.8,
  className,
}: {
  d: string;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
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
        'rounded-[20px] bg-white border border-line shadow-[0_1px_2px_rgba(20,40,30,0.04)]',
        onClick && 'cursor-pointer active:scale-[0.99] transition-transform',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  value,
  label,
  valueColor = 'text-green',
  dark = false,
}: {
  value: ReactNode;
  label: string;
  valueColor?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cx(
        'flex-1 rounded-2xl p-[13px] text-center',
        dark ? 'bg-green' : 'bg-white border border-line',
      )}
    >
      <div className={cx('font-serif text-[24px] leading-none', dark ? 'text-white' : valueColor)}>{value}</div>
      <div
        className={cx(
          'text-[10px] tracking-[0.05em] uppercase font-semibold mt-1',
          dark ? 'text-[#cfe0d6]' : 'text-muted',
        )}
      >
        {label}
      </div>
    </div>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-[7px] text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2">
      <span className="w-1.5 h-1.5 rounded-full bg-gold" />
      {children}
      {right && <span className="ml-auto tracking-[0.04em]">{right}</span>}
    </div>
  );
}

export function PrimaryButton({ children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cx(
        'w-full rounded-[14px] py-3.5 font-semibold text-[14px] bg-green text-white disabled:opacity-100 active:scale-[0.99] transition',
        rest.disabled && 'bg-[#dfe5df] text-[#9aa39b]',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function OutlineButton({ children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cx(
        'w-full rounded-[14px] py-3.5 font-semibold text-[13.5px] bg-white text-green border-[1.5px] border-[#d3ddd4] active:scale-[0.99] transition',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Pill toggle used for chips / segment options. */
export function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'px-3 py-2 rounded-[10px] text-[12px] font-semibold border-[1.5px] transition cursor-pointer',
        active ? 'border-green bg-mist text-green' : 'border-line bg-white text-muted',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function InfoNote({
  tone = 'green',
  icon = GLYPH.info,
  children,
}: {
  tone?: 'green' | 'amber';
  icon?: string;
  children: ReactNode;
}) {
  const box =
    tone === 'amber'
      ? 'bg-[#fbf3e2] border-[#ecd8ab] text-[#8a6d1f]'
      : 'bg-[#eef3ee] border-[#e0e7e0] text-[#3a4a41]';
  const stroke = tone === 'amber' ? '#a9761b' : '#15412f';
  return (
    <div className={cx('flex gap-[9px] items-start border rounded-[14px] p-3', box)}>
      <span className="flex-none mt-0.5" style={{ color: stroke }}>
        <Glyph d={icon} size={16} stroke={1.9} />
      </span>
      <div className="text-[11.5px] leading-[1.5]">{children}</div>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="min-h-screen flex justify-center items-center">
      <div className="w-6 h-6 rounded-full border-2 border-line border-t-green animate-spin" />
    </div>
  );
}

export function EmptyState({
  icon = GLYPH.diary,
  title,
  children,
}: {
  icon?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="text-center py-10 px-5 text-muted">
      <div className="w-[54px] h-[54px] rounded-full bg-[#f1f5f1] grid place-items-center mx-auto mb-3.5 text-[#9fb3a5]">
        <Glyph d={icon} size={24} />
      </div>
      <div className="text-[13.5px] font-semibold text-ink mb-1">{title}</div>
      {children && <p className="text-[12px] leading-[1.5] max-w-[210px] mx-auto">{children}</p>}
    </div>
  );
}

export function SuccessScreen({
  title,
  body,
  buttonLabel,
  onButton,
}: {
  title: string;
  body: string;
  buttonLabel: string;
  onButton: () => void;
}) {
  return (
    <div className="text-center py-10 px-4">
      <div className="w-[66px] h-[66px] rounded-full bg-mist grid place-items-center mx-auto mb-[18px] text-green">
        <Glyph d={GLYPH.check} size={30} stroke={2.4} />
      </div>
      <h3 className="font-serif text-[24px] mb-2">{title}</h3>
      <p className="text-[13px] text-muted leading-[1.5] max-w-[250px] mx-auto">{body}</p>
      <button
        onClick={onButton}
        className="max-w-[210px] w-full mx-auto mt-[22px] py-3.5 rounded-[14px] bg-green text-white font-semibold text-[14px]"
      >
        {buttonLabel}
      </button>
    </div>
  );
}

// ---- bottom sheet ----
export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40">
      <div onClick={onClose} className="absolute inset-0 bg-[rgba(15,25,20,0.42)]" />
      <div className="gw-sheet absolute left-0 right-0 bottom-0 bg-white rounded-t-[24px] px-[15px] pt-2 pb-[22px] max-h-[85%] overflow-y-auto gw-scroll">
        <div className="w-10 h-1 rounded-[3px] bg-[#e0e5df] mx-auto my-2 mb-3.5" />
        {children}
      </div>
    </div>
  );
}

/** Horizontal date strip used by the parent & teacher diary screens. */
export function DateStrip({
  dates,
  selDate,
  today,
  weekdayOf,
  onPick,
  hasDot,
}: {
  dates: string[];
  selDate: string;
  today: string;
  weekdayOf: (d: string) => string;
  onPick: (d: string) => void;
  hasDot: (d: string) => boolean;
}) {
  const wd = weekdayOf;
  return (
    <div className="gw-scroll flex gap-1.5 overflow-x-auto mb-3.5 pb-0.5">
      {dates.map((k) => {
        const active = k === selDate;
        return (
          <button
            key={k}
            onClick={() => onPick(k)}
            className={cx(
              'flex-none w-[46px] text-center pt-2 pb-[13px] rounded-[13px] text-[11px] font-semibold relative border',
              active
                ? 'bg-green border-green text-[#bcd2c5]'
                : k === today
                  ? 'bg-white border-[1.5px] border-green text-muted'
                  : 'bg-white border-line text-muted',
            )}
          >
            {wd(k)}
            <b className={cx('block text-[15px] mt-0.5', active ? 'text-white' : 'text-ink')}>{k}</b>
            {hasDot(k) && !active && (
              <span className="absolute bottom-[5px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---- header / shell chrome ----
export interface TabDef {
  key: string;
  label: string;
  glyph: string;
  active: boolean;
  onClick: () => void;
}

export function AppHeader({
  title,
  sub,
  onBack,
  onAccount,
  onBell,
  brand,
  logo,
}: {
  title: string;
  sub?: string;
  onBack?: () => void;
  onAccount?: () => void;
  onBell: () => void;
  /** School name — its first letter is the avatar fallback when no logo. */
  brand?: string;
  /** School logo URL. Falls back to the brand initial when absent/broken. */
  logo?: string | null;
}) {
  const initial = (brand?.trim()?.[0] ?? 'G').toUpperCase();
  return (
    <header className="flex items-center gap-[11px] px-4 pt-3 pb-[13px] bg-white border-b border-line z-10">
      {onBack ? (
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-[11px] bg-[#f1f5f1] grid place-items-center flex-none text-green"
          aria-label="Back"
        >
          <Glyph d={GLYPH.chevronLeft} size={18} stroke={2} />
        </button>
      ) : (
        <button
          onClick={onAccount}
          className="w-[38px] h-[38px] rounded-full bg-green grid place-items-center flex-none overflow-hidden shadow-[0_0_0_1.5px_#c2a04e,0_0_0_4px_#fff,0_0_0_5px_#efe6cf]"
          aria-label="Account"
        >
          {logo ? (
            <img
              src={logo}
              alt={brand ?? 'School'}
              className="w-full h-full object-contain bg-white"
              onError={(e) => {
                // Hide a broken image so the initial fallback shows through.
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (sib) sib.style.display = 'flex';
              }}
            />
          ) : null}
          <span
            className="font-serif text-white text-xl leading-none w-full h-full items-center justify-center"
            style={{ display: logo ? 'none' : 'flex' }}
          >
            {initial}
          </span>
        </button>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-serif text-[19px] leading-none truncate">{title}</div>
        {sub && <div className="text-[10px] text-muted tracking-[0.02em] mt-0.5 truncate">{sub}</div>}
      </div>
      <button
        onClick={onBell}
        className="w-[34px] h-[34px] rounded-[11px] bg-[#f1f5f1] grid place-items-center relative flex-none text-green"
        aria-label="Notifications"
      >
        <Glyph d={GLYPH.bell} size={18} stroke={1.8} />
        <span className="absolute top-[7px] right-2 w-[7px] h-[7px] rounded-full bg-gold border-[1.5px] border-white" />
      </button>
    </header>
  );
}

export function ClassBar({
  label,
  roleLabel,
  count,
  onOpen,
}: {
  label: string;
  roleLabel: string;
  count: number;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-[9px] bg-[#eef3ee] border-b border-[#e0e7e0]">
      <button
        onClick={onOpen}
        className="flex items-center gap-[7px] bg-white border border-[#d3ddd4] rounded-full px-3 py-1.5"
      >
        <span className="text-[12.5px] font-bold text-green">{label}</span>
        <span className="text-[10px] font-semibold text-muted">{roleLabel}</span>
        <span className="text-muted">
          <Glyph d="M6 9l6 6 6-6" size={13} stroke={2.2} />
        </span>
      </button>
      <span className="ml-auto text-[11px] text-muted font-semibold">{count} students</span>
    </div>
  );
}

export function TabBar({ tabs }: { tabs: TabDef[] }) {
  return (
    <nav className="flex justify-around items-center bg-white border-t border-line px-1.5 pt-2.5 pb-5">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={t.onClick}
          className={cx(
            'flex-1 flex flex-col items-center gap-1 text-[9.5px] font-semibold',
            t.active ? 'text-green' : 'text-muted',
          )}
        >
          <Glyph d={t.glyph} size={21} stroke={t.active ? 2 : 1.8} />
          {t.label}
        </button>
      ))}
    </nav>
  );
}

/**
 * The phone-style app frame: full-bleed on phones, a centered 430px column on
 * desktop. Header + optional class bar are fixed; children scroll.
 */
export function Shell({
  header,
  classBar,
  tabs,
  children,
  overlays,
}: {
  header: ReactNode;
  classBar?: ReactNode;
  tabs: TabDef[];
  children: ReactNode;
  overlays?: ReactNode;
}) {
  return (
    <div className="min-h-full w-full flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen bg-cloud flex flex-col relative shadow-[0_20px_60px_-25px_rgba(20,40,30,0.35)] md:my-6 md:min-h-[calc(100vh-3rem)] md:rounded-[32px] md:overflow-hidden">
        {header}
        {classBar}
        <main className="gw-scroll flex-1 overflow-y-auto overflow-x-hidden relative">{children}</main>
        <TabBar tabs={tabs} />
        {overlays}
      </div>
    </div>
  );
}
