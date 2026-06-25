export default function PayPage({
  params,
}: {
  params: { planId: string };
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Complete Your Payment
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Plan ID: <span className="font-mono text-indigo-600">{params.planId}</span>
          </p>
        </div>

        <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Plan</span>
            <span className="font-medium text-gray-900 dark:text-white">—</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Billing</span>
            <span className="font-medium text-gray-900 dark:text-white">—</span>
          </div>
          <div className="flex justify-between text-sm font-semibold border-t border-indigo-100 dark:border-indigo-800 pt-2 mt-2">
            <span className="text-gray-900 dark:text-white">Total</span>
            <span className="text-indigo-600">—</span>
          </div>
        </div>

        <form className="space-y-4">
          <div>
            <label htmlFor="card-number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Card Number</label>
            <input id="card-number" type="text" placeholder="1234 5678 9012 3456" className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="expiry" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Expiry</label>
              <input id="expiry" type="text" placeholder="MM / YY" className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label htmlFor="cvc" className="block text-sm font-medium text-gray-700 dark:text-gray-300">CVC</label>
              <input id="cvc" type="text" placeholder="123" className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <button type="submit" className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors">
            Subscribe Now
          </button>
        </form>
      </div>
    </div>
  );
}
