import { Pill } from "lucide-react";
import { cn } from "@/lib/utils";

/** The pharmacy's uploaded logo, or a pill icon in the brand colour. */
export function BrandLogo({ logoUrl, name, className }: { logoUrl: string | null; name: string; className?: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- served from our DB, not optimisable by next/image
    return <img src={logoUrl} alt={name} className={cn("size-9 rounded-lg object-contain", className)} />;
  }
  return (
    <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-brand-600 text-white", className)}>
      <Pill className="size-[55%]" />
    </div>
  );
}
