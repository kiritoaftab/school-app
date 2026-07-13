import type { ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-muted mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

const inputBase = 'w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[14px]';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} resize-none ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} ${props.className ?? ''}`} />;
}

export function Note({ children, tone = 'ok' }: { children: ReactNode; tone?: 'ok' | 'err' }) {
  return (
    <p className={`text-[13px] ${tone === 'ok' ? 'text-success' : 'text-danger'}`}>{children}</p>
  );
}
