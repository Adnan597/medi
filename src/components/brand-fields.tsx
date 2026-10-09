"use client";

import { useEffect, useState } from "react";
import { Pill, Upload } from "lucide-react";
import { BRAND_PRESETS, DEFAULT_BRAND_COLOR, LOGO_MAX_BYTES, isHexColor } from "@/lib/brand";
import { Field, Input } from "./ui";
import { cn } from "@/lib/utils";

/**
 * Logo upload + brand colour picker with a live preview.
 * Renders form inputs named: logo (file), removeLogo, brandColor, storeName, tagline.
 */
export function BrandFields({
  storeName: initialName = "",
  tagline: initialTagline = "",
  brandColor = DEFAULT_BRAND_COLOR,
  logoUrl = null,
  allowRemove = false,
}: {
  storeName?: string;
  tagline?: string;
  brandColor?: string;
  logoUrl?: string | null;
  allowRemove?: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [tagline, setTagline] = useState(initialTagline);
  const [color, setColor] = useState(brandColor);
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [remove, setRemove] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Preview the whole page in the chosen colour while editing
  useEffect(() => {
    if (isHexColor(color)) document.documentElement.style.setProperty("--brand", color);
  }, [color]);
  useEffect(() => () => {
    document.documentElement.style.removeProperty("--brand");
  }, []);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFileError(null);
    if (!f) return;
    if (f.size > LOGO_MAX_BYTES) {
      setFileError(`Too large — max ${LOGO_MAX_BYTES / 1024} KB`);
      e.target.value = "";
      return;
    }
    setRemove(false);
    setPreview(URL.createObjectURL(f));
  }

  const shownLogo = remove ? null : preview;

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_260px]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Pharmacy name *"><Input name="storeName" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Shifa Pharmacy" /></Field>
          <Field label="Tagline" hint="Shown under the name"><Input name="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. 24/7 Medical Store" /></Field>
        </div>

        <Field label="Logo" hint="PNG, JPG or WEBP · max 300 KB · square works best">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
              <Upload className="size-4" /> Choose image
              <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onFile} />
            </label>
            {allowRemove && preview && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="removeLogo" checked={remove} onChange={(e) => setRemove(e.target.checked)} className="accent-brand-600" /> Remove logo
              </label>
            )}
          </div>
          {fileError && <span className="block text-xs text-red-600">{fileError}</span>}
        </Field>

        <Field label="Brand colour">
          <div className="flex flex-wrap items-center gap-2">
            {BRAND_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                title={p.name}
                onClick={() => setColor(p.value)}
                className={cn("size-8 rounded-full border-2 transition", color.toLowerCase() === p.value ? "scale-110 border-slate-900" : "border-white shadow")}
                style={{ background: p.value }}
              />
            ))}
            <input type="color" value={isHexColor(color) ? color : DEFAULT_BRAND_COLOR} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-slate-300" aria-label="Custom colour" />
            <input type="hidden" name="brandColor" value={color} />
          </div>
        </Field>
      </div>

      {/* Live preview */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Preview</p>
        <div className="flex items-center gap-2.5 rounded-lg bg-white p-3 shadow-sm">
          {shownLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL)
            <img src={shownLogo} alt="" className="size-10 rounded-lg object-contain" />
          ) : (
            <div className="grid size-10 place-items-center rounded-lg text-white" style={{ background: color }}><Pill className="size-5" /></div>
          )}
          <div className="min-w-0 leading-tight">
            <div className="truncate font-semibold">{name || "Pharmacy name"}</div>
            <div className="truncate text-xs text-slate-500">{tagline || "Tagline"}</div>
          </div>
        </div>
        <div className="mt-3 rounded-lg px-3 py-2 text-center text-sm font-medium text-white" style={{ background: color }}>Button</div>
        <div className="mt-2 rounded-lg px-3 py-2 text-sm" style={{ background: `color-mix(in oklab, ${color} 8%, white)`, color }}>Active menu item</div>
      </div>
    </div>
  );
}
