"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: "dashboard" },
  { label: "Plans", href: "/dashboard/plans", icon: "payments" },
  { label: "Subscribers", href: "/dashboard/subscribers", icon: "group" },
  { label: "Ledger", href: "/dashboard/ledger", icon: "account_balance" },
  { label: "Wallets", href: "/dashboard/wallets", icon: "account_balance_wallet" },
  { label: "Invoices", href: "/dashboard/invoices", icon: "receipt_long" },
  { label: "Developers", href: "/dashboard/developers", icon: "code" },
];

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { label: "Settings", href: "/dashboard/settings", icon: "settings" },
];

function SidebarNavItem({ item, isActive, onClick, }: {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <li>
      <Link href={item.href} onClick={onClick} className={[
        "flex items-center gap-3 px-4 py-3 transition-all duration-200 active:scale-95 cursor-pointer",
        isActive ? "bg-white/10 text-white font-semibold border-r-4 border-white" : "text-[#b7c8e1]/70 hover:bg-white/5 hover:text-[#b7c8e1]",
      ].join(" ")}>
        <span className="material-symbols-outlined text-[22px] leading-none"> {item.icon} </span>
        <span className="text-sm font-medium leading-5">{item.label}</span>
      </Link>
    </li>
  );
}

function Sidebar({ pathname, onClose, }: {
  pathname: string;
  onClose?: () => void;
}) {
  return (
    <div className="flex flex-col h-full py-6 bg-[#0b1c30]">
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-[22px]">
            bolt
          </span>
        </div>
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">
            FlexCharge
          </h1>
          <p className="text-xs text-[#b7c8e1]/60 leading-4">
            Enterprise Dashboard
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-1 w-full flex-grow">
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem key={item.href} item={item} isActive={item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href)} onClick={onClose} />
        ))}
      </ul>
      <ul className="flex flex-col gap-1 w-full mt-auto">
        {BOTTOM_NAV_ITEMS.map((item) => (
          <SidebarNavItem key={item.href} item={item} isActive={pathname.startsWith(item.href)} onClick={onClose} />
        ))}
      </ul>
    </div>
  );
}

export default function DashboardLayout({ children, }: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? sessionStorage.getItem("fc_token") : null;
    if (!token) {
      router.replace("/login");
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem("fc_token");
    sessionStorage.removeItem("fc_user");
    router.push("/login");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 antialiased">
      <nav className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 z-50 shadow-sm">
        <Sidebar pathname={pathname} />
      </nav>
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}
      <nav className={["fixed top-0 left-0 h-full w-64 z-50 md:hidden transition-transform duration-300 shadow-xl", mobileMenuOpen ? "translate-x-0" : "-translate-x-full",].join(" ")}>
        <Sidebar pathname={pathname} onClose={() => setMobileMenuOpen(false)} />
      </nav>
      <header className="fixed top-0 right-0 w-full md:w-[calc(100%-16rem)] bg-white border-b border-slate-200 flex items-center justify-between h-16 px-6 md:px-8 z-40 transition-all duration-300">
        <button className="md:hidden text-slate-600 hover:text-[#4F46E5] transition-colors p-1 rounded-full" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
          <span className="material-symbols-outlined">menu</span>
        </button>

        <div className="md:hidden flex-grow text-center">
          <span className="text-lg font-bold text-slate-900">FlexCharge</span>
        </div>
        <div className="hidden md:flex items-center flex-grow max-w-md">
          <div className="relative w-full focus-within:ring-2 focus-within:ring-indigo-200 rounded-lg transition-all duration-200">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none text-[20px] leading-none">
              search
            </span>
            <input type="text" placeholder="Search transactions, users..." className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0 transition-colors hover:bg-slate-200/60" />
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <button className="relative text-slate-500 hover:text-[#4F46E5] transition-colors p-1 rounded-full">
            <span className="material-symbols-outlined text-[22px] leading-none">
              notifications
            </span>
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          <button className="hidden sm:block text-slate-500 hover:text-[#4F46E5] transition-colors p-1 rounded-full">
            <span className="material-symbols-outlined text-[22px] leading-none">
              help_outline
            </span>
          </button>

          <div className="relative">
            <div 
              className="w-8 h-8 rounded-full bg-indigo-100 overflow-hidden border border-slate-200 cursor-pointer hover:ring-2 hover:ring-indigo-300 transition-all flex items-center justify-center text-xs font-semibold text-indigo-700 select-none"
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            >
              M
            </div>
            {profileMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50 border border-slate-100">
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="pt-24 pb-12 px-4 md:px-8 md:ml-64 max-w-[1280px] mx-auto min-h-screen flex flex-col gap-6">
        {children}
      </main>
    </div>
  );
}
