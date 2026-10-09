"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, ShoppingCart, Receipt, Pill, PackagePlus, Boxes, Truck, Users, Wallet, BarChart3, Settings, LogOut, Menu, X, UserCog, Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Permission } from "@/lib/auth";
import { BrandLogo } from "./brand-logo";

const NAV: { href: string; label: string; icon: typeof Pill; perm?: Permission }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "POS / New Sale", icon: ShoppingCart, perm: "pos" },
  { href: "/sales", label: "Sales", icon: Receipt, perm: "sales" },
  { href: "/medicines", label: "Medicines", icon: Pill, perm: "medicines" },
  { href: "/purchases", label: "Purchases", icon: PackagePlus, perm: "purchases" },
  { href: "/purchase-returns", label: "Purchase Returns", icon: Undo2, perm: "purchases" },
  { href: "/stock", label: "Stock & Expiry", icon: Boxes, perm: "stock" },
  { href: "/suppliers", label: "Suppliers", icon: Truck, perm: "suppliers" },
  { href: "/customers", label: "Customers", icon: Users, perm: "customers" },
  { href: "/expenses", label: "Expenses", icon: Wallet, perm: "expenses" },
  { href: "/reports", label: "Reports", icon: BarChart3, perm: "reports" },
  { href: "/settings", label: "Settings", icon: Settings, perm: "settings" },
];

export function Sidebar({
  user,
  allowed,
  storeName,
  tagline,
  logoUrl,
  appName,
  logout,
}: {
  user: { name: string; role: string };
  allowed: Permission[];
  storeName: string;
  tagline: string;
  logoUrl: string | null;
  appName: string;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => !n.perm || allowed.includes(n.perm));
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <div className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <BrandLogo logoUrl={logoUrl} name={storeName} className="size-7" />
          <span className="truncate font-semibold text-brand-700">{storeName}</span>
        </span>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-md p-1.5 hover:bg-slate-100">
          <Menu className="size-5" />
        </button>
      </div>

      {open && <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandLogo logoUrl={logoUrl} name={storeName} className="size-10" />
            <div className="min-w-0 leading-tight">
              <div className="truncate font-semibold text-slate-900" title={storeName}>{storeName}</div>
              <div className="truncate text-xs text-slate-500">{tagline || appName}</div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-slate-100 lg:hidden" aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon className="size-4.5" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <Link href="/account" className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-100">
            <UserCog className="size-4.5 text-slate-500" />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="text-xs capitalize text-slate-500">{user.role.toLowerCase()}</div>
            </div>
          </Link>
          <form action={logout}>
            <button className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-red-50 hover:text-red-700">
              <LogOut className="size-4.5" /> Logout
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
