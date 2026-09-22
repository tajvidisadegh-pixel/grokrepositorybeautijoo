import { PanelLoading } from '@/components/panel/state-blocks';

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PanelLoading skeleton rows={3} />
    </div>
  );
}
