type P = { size?: number; className?: string; stroke?: number };

function base(path: ReactNode, { size = 22, className, stroke = 2 }: P) {
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
      {path}
    </svg>
  );
}

import type { ReactNode } from 'react';

export const Icon = {
  check: (p: P) => base(<path d="M5 12l5 5L20 6" />, p),
  home: (p: P) => base(<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>, p),
  calendar: (p: P) => base(<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18" /></>, p),
  bell: (p: P) => base(<><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 004 0" /></>, p),
  book: (p: P) => base(<><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z" /><path d="M19 3v18" /></>, p),
  clipboard: (p: P) => base(<><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 10h6M9 14h4" /></>, p),
  award: (p: P) => base(<><circle cx="12" cy="9" r="6" /><path d="M9 14l-2 7 5-3 5 3-2-7" /></>, p),
  image: (p: P) => base(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-9 9" /></>, p),
  megaphone: (p: P) => base(<><path d="M3 11v2a1 1 0 001 1h3l6 4V6L7 10H4a1 1 0 00-1 1z" /><path d="M18 8a4 4 0 010 8" /></>, p),
  chevronRight: (p: P) => base(<path d="M9 6l6 6-6 6" />, p),
  chevronLeft: (p: P) => base(<path d="M15 6l-6 6 6 6" />, p),
  logout: (p: P) => base(<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>, p),
  plus: (p: P) => base(<path d="M12 5v14M5 12h14" />, p),
  users: (p: P) => base(<><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0112 0" /><path d="M16 6a3 3 0 010 6M21 20a6 6 0 00-4-5.6" /></>, p),
  phone: (p: P) => base(<path d="M4 4h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2" />, p),
  clock: (p: P) => base(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, p),
};
