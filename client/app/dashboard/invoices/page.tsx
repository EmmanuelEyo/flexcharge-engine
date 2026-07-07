"use client";

import React, { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import api from "@/lib/api";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await api.get("/invoices");
      setInvoices(res.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRefund = (invoice: any) => {
    setSelectedInvoice(invoice);
    setIsRefundModalOpen(true);
    setBankCode("");
    setAccountNumber("");
    setError("");
  };

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    try {
      setRefundLoading(true);
      setError("");
      await api.post("/ledger/v1/refunds", {
        invoiceId: selectedInvoice._id,
        bankCode: bankCode || undefined,
        accountNumber: accountNumber || undefined,
      });
      setIsRefundModalOpen(false);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (err: any) {
      setError(err.message || "Failed to process refund");
    } finally {
      setRefundLoading(false);
    }
  };

  const printInvoice = (invoiceId: string) => {
    const inv = invoices.find(i => i._id === invoiceId);
    if (!inv) return;

    let tenantName = inv.tenantId?.name || "FlexCharge Merchant";
    if (!inv.tenantId?.name) {
      try {
        const stored = localStorage.getItem("fc_user");
        if (stored) {
          const tenant = JSON.parse(stored);
          if (tenant?.name) tenantName = tenant.name;
        }
      } catch (e) {
        console.error(e);
      }
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const formattedDate = new Date(inv.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    const planName = inv.subscriptionId?.planId?.name || inv.description || "Unknown Plan";

    const html = `
      <html>
        <head>
          <title>Invoice - ${inv.invoiceNumber || inv._id.slice(-8).toUpperCase()}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0f172a; max-width: 600px; margin: 0 auto; line-height: 1.5; }
            h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; color: #0f172a; }
            .meta { color: #64748b; font-size: 14px; margin-bottom: 32px; }
            .meta p { margin: 4px 0; }
            .row { display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding: 16px 0; font-size: 15px; }
            .row:last-child { border-bottom: none; }
            .total { font-weight: 600; font-size: 18px; margin-top: 16px; border-top: 2px solid #e2e8f0; border-bottom: none; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; text-transform: capitalize; }
            .badge-paid { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
            .badge-pending { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
            .badge-refunded { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
            .badge-failed { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
            .footer { margin-top: 48px; text-align: center; color: #94a3b8; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>Invoice from ${tenantName}</h1>
          <div class="meta">
            <p>Invoice ID: ${inv.invoiceNumber || inv._id.slice(-8).toUpperCase()}</p>
            <p>Date: ${formattedDate}</p>
            <p>Billed to: ${inv.customerId?.name || "Unknown Customer"} (${inv.customerId?.email || ""})</p>
          </div>
          
          <div class="row">
            <span style="color: #64748b">Plan / Description</span>
            <span>${planName}</span>
          </div>

          <div class="row">
            <span style="color: #64748b">Status</span>
            <span class="badge badge-${inv.status}">${inv.status}</span>
          </div>
          
          <div class="row total">
            <span>Total Amount</span>
            <span>${formatCurrency(inv.amount)}</span>
          </div>
          
          <div class="footer">
            <p>Powered by FlexCharge</p>
          </div>
          
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const formatCurrency = (kobo: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format((kobo || 0) / 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">Paid</span>;
      case "failed":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-100">Failed</span>;
      case "refunded":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">Refunded</span>;
      case "pending":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Pending</span>;
      default:
        const capitalized = status ? status.charAt(0).toUpperCase() + status.slice(1) : "";
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">{capitalized}</span>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Billing Invoices</h2>
          <p className="text-base text-slate-500 mt-1">
            View all historical invoices and process refunds.
          </p>
        </div>
      </div>

      {error && !isRefundModalOpen && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center border border-red-100">
          <span className="material-symbols-outlined mr-2">error</span>
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full whitespace-nowrap text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-4 px-6 font-semibold text-sm text-slate-500 uppercase tracking-wider">Invoice / Date</th>
                  <th className="py-4 px-6 font-semibold text-sm text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="py-4 px-6 font-semibold text-sm text-slate-500 uppercase tracking-wider text-right">Amount</th>
                  <th className="py-4 px-6 font-semibold text-sm text-slate-500 uppercase tracking-wider text-center">Status</th>
                  <th className="py-4 px-6 font-semibold text-sm text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length > 0 ? (
                  invoices.map((inv) => (
                    <tr key={inv._id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-4 px-6">
                        <p className="text-sm font-medium text-slate-900 font-mono">
                          {inv.invoiceNumber || inv._id.slice(-8).toUpperCase()}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(inv.createdAt).toLocaleString()}
                        </p>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-900">
                        {inv.customerId?.name || "Unknown"}
                      </td>
                      <td className="py-4 px-6 text-sm text-right font-bold text-slate-900">
                        {formatCurrency(inv.amount)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {getStatusBadge(inv.status)}
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <button 
                          onClick={() => printInvoice(inv._id)}
                          className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded transition-colors"
                          title="Print / Download PDF"
                        >
                          <span className="material-symbols-outlined text-[18px]">print</span>
                        </button>
                        {inv.status === "paid" && (
                          <button
                            onClick={() => handleOpenRefund(inv)}
                            className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
                            title="Issue Refund"
                          >
                            <span className="material-symbols-outlined text-[18px]">currency_exchange</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 px-6 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-3">
                        <span className="material-symbols-outlined text-[32px]">receipt_long</span>
                      </div>
                      <p className="text-lg font-medium text-slate-900">No invoices yet</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isRefundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsRefundModalOpen(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-slate-900">Issue Refund</h3>
              <button onClick={() => setIsRefundModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            {error && (
              <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl flex items-start border border-red-100 text-sm">
                <span className="material-symbols-outlined mr-2 text-[20px] flex-shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRefund}>
              <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600">Refund Amount</span>
                <span className="font-bold text-slate-900">{formatCurrency(selectedInvoice?.amount || 0)}</span>
              </div>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer Bank Code (Optional)</label>
                  <input
                    type="text"
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                    placeholder="e.g. 058"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">Nomba destination bank code (only needed for bank transfers).</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer Account Number (Optional)</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="10-digit account"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="secondary" onClick={() => setIsRefundModalOpen(false)} type="button">Cancel</Button>
                <Button type="submit" disabled={refundLoading}>
                  {refundLoading ? "Processing..." : "Issue Refund"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
