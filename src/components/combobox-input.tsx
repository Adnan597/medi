"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function ComboboxInput({
  name,
  defaultValue = "",
  placeholder = "Select or type new",
  options = [],
  required = false,
  readOnly = false,
  className,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  options: string[];
  required?: boolean;
  readOnly?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes((value ?? "").toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          name={name}
          value={value}
          required={required}
          readOnly={readOnly}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => !readOnly && setIsOpen(true)}
          className={cn(
            "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-100",
            className
          )}
        />
        {!readOnly && options.length > 0 && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setIsOpen((open) => !open)}
            className="absolute right-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
          >
            <ChevronDown className="size-4" />
          </button>
        )}
      </div>

      {isOpen && !readOnly && filtered.length > 0 && (
        <div className="absolute left-0 z-30 mt-1 max-h-52 w-full min-w-[200px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {filtered.map((opt) => (
            <button
              type="button"
              key={opt}
              onClick={() => {
                setValue(opt);
                setIsOpen(false);
              }}
              className={cn(
                "block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-brand-50 hover:text-brand-900",
                opt === value ? "bg-brand-50 font-medium text-brand-700" : "text-slate-700"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
