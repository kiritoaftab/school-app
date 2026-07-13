import type { ReactNode } from 'react';

/**
 * Mobile-first app frame. Full-bleed on phones; on desktop it centers a
 * 430px-wide app column on the neutral background (the mock's phone look,
 * simplified). Everything inside scrolls within this column.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full w-full flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-cloud flex flex-col relative shadow-[0_20px_60px_-25px_rgba(20,40,30,0.35)] md:my-6 md:min-h-[calc(100vh-3rem)] md:rounded-[32px] md:overflow-hidden">
        {children}
      </div>
    </div>
  );
}
