export function AdminLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4 md:p-6">
      <div className="h-8 w-48 rounded-lg bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-slate-200" />
        ))}
      </div>
    </div>
  );
}
