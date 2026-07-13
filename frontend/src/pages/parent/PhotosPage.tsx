import { Link } from 'react-router-dom';
import { useAlbums } from '../../api/parent';
import { Spinner, EmptyState } from '../../components/ui';
import { Icon } from '../../components/icons';

export function PhotosPage() {
  const { data, isLoading } = useAlbums();
  return (
    <div className="pb-6">
      <div className="px-4 pt-4">
        <h1 className="font-serif text-[30px] leading-tight">Photo Gallery</h1>
      </div>
      {isLoading ? (
        <Spinner />
      ) : data && data.length > 0 ? (
        <div className="px-4 mt-4 grid grid-cols-2 gap-3">
          {data.map((a) => (
            <Link key={a.id} to={`/app/photos/${a.id}`}>
              <div className="rounded-[18px] overflow-hidden border border-line bg-white">
                <div className="aspect-square bg-mist grid place-items-center overflow-hidden">
                  {a.coverUrl ? (
                    <img src={a.coverUrl} alt={a.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-green/40"><Icon.image size={40} /></span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="font-semibold text-[13px] leading-tight truncate">{a.title}</p>
                  <p className="text-[11px] text-muted">{a.count} photos</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState>No albums yet.</EmptyState>
      )}
    </div>
  );
}
