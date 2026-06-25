interface Subscriber {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: "active" | "cancelled" | "past_due";
  since: string;
}

interface SubscriberTableProps {
  subscribers?: Subscriber[];
}

const STATUS_STYLES: Record<string, string> = {
  active:
    "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  cancelled:
    "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
  past_due:
    "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
};

export default function SubscriberTable({ subscribers = [] }: SubscriberTableProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <tr>
            {["Name", "Email", "Plan", "Status", "Since"].map((h) => (
              <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {subscribers.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-12 text-center text-gray-400 dark:text-gray-600">
                No subscribers yet.
              </td>
            </tr>
          ) : (
            subscribers.map((sub) => (
              <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                  {sub.name}
                </td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{sub.email}</td>
                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{sub.plan}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[sub.status]}`}>
                    {sub.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{sub.since}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
