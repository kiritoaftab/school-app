import { useStudent } from './StudentContext';
import { cx } from '../components/ui';

export function ChildSwitcher() {
  const { students, selectedId, setSelectedId } = useStudent();
  if (students.length <= 1) return null;
  return (
    <div className="flex gap-2 overflow-x-auto gw-scroll px-4 pt-3">
      {students.map((s) => (
        <button
          key={s.id}
          onClick={() => setSelectedId(s.id)}
          className={cx(
            'flex-none px-3.5 py-2 rounded-full text-[13px] font-semibold border transition',
            s.id === selectedId
              ? 'bg-green text-white border-green'
              : 'bg-white text-muted border-line',
          )}
        >
          {s.name.split(' ')[0]}
        </button>
      ))}
    </div>
  );
}
