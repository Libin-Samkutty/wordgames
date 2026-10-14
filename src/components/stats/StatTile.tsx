/** One labelled number in a statistics grid; the value reads first, the label under it. */
export function StatTile({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center">
      <dt className="order-2 text-center text-[0.65rem] leading-tight text-text-muted">{label}</dt>
      <dd className="order-1 text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}
