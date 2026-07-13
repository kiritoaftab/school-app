import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useStudents, type Student } from '../api/parent';

interface StudentState {
  students: Student[];
  loading: boolean;
  selected: Student | null;
  selectedId: number | null;
  setSelectedId: (id: number) => void;
}

const Ctx = createContext<StudentState | null>(null);

export function StudentProvider({ children }: { children: ReactNode }) {
  const { data: students = [], isLoading } = useStudents();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const effectiveId = selectedId ?? students[0]?.id ?? null;
  const selected = useMemo(
    () => students.find((s) => s.id === effectiveId) ?? null,
    [students, effectiveId],
  );

  return (
    <Ctx.Provider
      value={{ students, loading: isLoading, selected, selectedId: effectiveId, setSelectedId }}
    >
      {children}
    </Ctx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStudent() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStudent must be used within StudentProvider');
  return ctx;
}
