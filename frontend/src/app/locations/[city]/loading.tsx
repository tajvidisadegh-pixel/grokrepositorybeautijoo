import { GridSkeleton } from '@/components/panel/state-blocks';

export default function LocationCityLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 h-8 w-40 animate-pulse rounded-md bg-gray-200/80" />
      <GridSkeleton cards={6} />
    </div>
  );
}
