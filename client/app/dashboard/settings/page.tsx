export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          API Keys &amp; Webhooks
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">API Keys</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Use these keys to authenticate requests from your server.
        </p>
        <div className="flex items-center gap-3">
          <input id="api-key" type="text" readOnly value="sk_live_••••••••••••••••" className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white font-mono focus:outline-none" />
          <button className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Copy
          </button>
          <button className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors">
            Regenerate
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Webhooks</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          FlexCharge will POST to this URL when subscription events occur.
        </p>
        <div className="flex items-center gap-3">
          <input id="webhook-url" type="url" placeholder="https://your-server.com/webhooks/flexcharge" className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
            Save
          </button>
        </div>
      </section>
    </div>
  );
}
