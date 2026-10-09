import { redirect } from "next/navigation";
import { getSettings, needsSetup } from "@/lib/settings";
import { APP_NAME, poweredBy } from "@/lib/brand";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Setup" };

export default async function SetupPage() {
  // Only reachable on a fresh database
  if (!(await needsSetup())) redirect("/login");
  const s = await getSettings();
  // The schema default name is a placeholder — show an empty field instead.
  const storeName = s.storeName === "Medical Store" ? "" : s.storeName;

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-slate-100 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold">Welcome to {APP_NAME}</h1>
          <p className="mt-1 text-sm text-slate-500">Set up this pharmacy. You can change all of this later in Settings.</p>
        </div>
        <SetupForm
          preset={{ storeName, tagline: s.tagline, brandColor: s.brandColor, logoUrl: s.logoUrl, phone: s.phone, licenseNo: s.licenseNo, address: s.address }}
        />
        <p className="mt-6 text-center text-xs text-slate-400">{poweredBy()}</p>
      </div>
    </main>
  );
}
