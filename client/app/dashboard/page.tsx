export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Overview</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Your business at a glance
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {["Total Revenue", "Active Subscribers", "Plans"].map((label) => (
          <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">—</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 h-64 flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-600 text-sm">Chart goes here</p>
      </div>
    </div>
  );
}
