"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="no-print mt-4 w-full rounded border border-black py-1.5 font-sans text-sm">
      Print
    </button>
  );
}
