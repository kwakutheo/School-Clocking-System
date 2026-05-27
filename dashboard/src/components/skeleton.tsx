export function Skeleton({ width, height, circle, style }: {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: width ?? '100%',
        height: height ?? 16,
        borderRadius: circle ? '50%' : 6,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        ...style,
      }}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <Skeleton width={42} height={42} style={{ marginBottom: 14, borderRadius: 10 }} />
      <Skeleton width={60} height={30} style={{ marginBottom: 4 }} />
      <Skeleton width={100} height={16} />
    </div>
  );
}

export function TableRowSkeleton({ cols = 6 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '14px 24px' }}>
          <Skeleton width={i === 0 ? 140 : 80} height={14} />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrap">
      <div className="table-header">
        <Skeleton width={140} height={18} />
        <Skeleton width={80} height={14} />
      </div>
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} style={{ padding: '12px 24px' }}>
                <Skeleton width={60} height={11} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
