import type { DeviceStatus } from '../data/mockData';
import { STATUS_COLORS, STATUS_DOT, STATUS_LABELS } from '../data/mockData';

export default function StatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}
