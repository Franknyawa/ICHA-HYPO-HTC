export function AdminPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4 dark:border-slate-800 dark:bg-slate-900 md:px-6">
      <div>
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
