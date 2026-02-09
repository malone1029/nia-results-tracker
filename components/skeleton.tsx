/**
 * Skeleton loading components — pulsing placeholder shapes that
 * mirror the layout of real content while data is loading.
 */

/** Base skeleton element — a shimmer sweep effect that implies loading activity */
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
    />
  );
}

/** Page title + subtitle placeholder */
function PageHeaderSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-56 mb-2" />
      <Skeleton className="h-4 w-80" />
    </div>
  );
}

/** Grid of stat cards (e.g., dashboard summary row) */
function StatCardsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg shadow p-4">
          <Skeleton className="h-3 w-16 mb-3" />
          <Skeleton className="h-7 w-10" />
        </div>
      ))}
    </div>
  );
}

/** A single white card with a few content lines */
function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-lg shadow p-5 border-l-4 border-gray-100">
      <Skeleton className="h-5 w-48 mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 mb-2 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

/** Table-style skeleton with header row and body rows */
function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 flex gap-6">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16 hidden md:block" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-t border-gray-100 flex gap-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12 hidden md:block" />
        </div>
      ))}
    </div>
  );
}

/** Form field skeleton — label + input */
function FormFieldSkeleton() {
  return (
    <div>
      <Skeleton className="h-3 w-24 mb-2" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

// ─── Page-level skeleton compositions ───────────────────────────

/** Dashboard page: stat cards + metric sections */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <StatCardsSkeleton count={5} />
      <CardSkeleton lines={2} />
      <CardSkeleton lines={4} />
      <CardSkeleton lines={3} />
    </div>
  );
}

/** List pages: header + optional stat cards + table (processes, schedule, etc.) */
export function ListPageSkeleton({ showStats = false, statCount = 4 }: { showStats?: boolean; statCount?: number }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      {showStats && <StatCardsSkeleton count={statCount} />}
      <TableSkeleton rows={6} />
    </div>
  );
}

/** Detail pages: header card + content sections (metric detail, process detail) */
export function DetailSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-lg shadow p-6">
        <Skeleton className="h-8 w-64 mb-3" />
        <Skeleton className="h-4 w-48 mb-4" />
        <div className="flex gap-3 mt-4">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
      {/* Content sections */}
      {Array.from({ length: sections }).map((_, i) => (
        <CardSkeleton key={i} lines={i === 0 ? 4 : 3} />
      ))}
    </div>
  );
}

/** Form pages: header + form card with fields (edit metric, edit process, new metric) */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeaderSkeleton />
      <div className="bg-white rounded-lg shadow p-6 space-y-5">
        {Array.from({ length: fields }).map((_, i) => (
          <FormFieldSkeleton key={i} />
        ))}
        <Skeleton className="h-10 w-32 rounded-lg mt-4" />
      </div>
    </div>
  );
}

/** Category grid skeleton — for categories and processes pages */
export function CategoryGridSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      {/* Category coverage grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-3">
            <Skeleton className="h-3 w-full mb-2" />
            <Skeleton className="h-6 w-8 mb-2" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={5} />
    </div>
  );
}
