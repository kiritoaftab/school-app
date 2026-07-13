import { useParams } from 'react-router-dom';
import { useAlbum } from '../../api/parent';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Spinner } from '../../components/ui';

export function AlbumPage() {
  const { id } = useParams();
  const { data, isLoading } = useAlbum(Number(id));

  return (
    <div className="pb-6">
      <ScreenHeader title={data?.title ?? 'Album'} />
      {isLoading || !data ? (
        <Spinner />
      ) : (
        <div className="px-4 grid grid-cols-2 gap-2">
          {data.photos.map((p) => (
            <div key={p.id} className="aspect-square rounded-xl overflow-hidden bg-mist">
              <img src={p.url} alt={p.caption ?? ''} className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
