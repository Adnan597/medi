"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "./ui";
import { cn } from "@/lib/utils";

/** Search box that calls a server action and lets the user pick a result. */
export function AsyncSearch<T extends { id: string }>({
  search,
  onPick,
  render,
  placeholder,
  autoFocus,
}: {
  search: (q: string) => Promise<T[]>;
  onPick: (item: T) => void;
  render: (item: T) => ReactNode;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [hi, setHi] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const req = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const id = ++req.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await search(q);
      if (id === req.current) {
        setItems(r);
        setHi(0);
        setLoading(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q, isOpen, search]);

  function pick(item: T) {
    onPick(item);
    setQ("");
    setIsOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
      <Input
        ref={inputRef}
        value={q}
        autoFocus={autoFocus}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setIsOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setIsOpen(true); setHi((h) => Math.min(h + 1, items.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          if (e.key === "Enter") { e.preventDefault(); if (items[hi]) pick(items[hi]); }
          if (e.key === "Escape") setIsOpen(false);
        }}
        placeholder={placeholder}
        className="pl-9"
      />
      {isOpen && (
        <div className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {loading && !items.length && <p className="p-3 text-sm text-slate-400">Loading medicines…</p>}
          {!loading && !items.length && <p className="p-3 text-sm text-slate-400">No medicines found</p>}
          {items.map((it, i) => (
            <button
              type="button"
              key={it.id}
              onMouseEnter={() => setHi(i)}
              onClick={() => pick(it)}
              className={cn("block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0", i === hi && "bg-brand-50")}
            >
              {render(it)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
