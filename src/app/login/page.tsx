import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { BrandLogo } from "@/components/brand-logo";
import { Field, Input } from "@/components/ui";
import { login } from "@/app/actions/auth";
import { getSettings, needsSetup } from "@/lib/settings";
import { getUser } from "@/lib/auth";
import { poweredBy } from "@/lib/brand";

export const metadata = { title: "Login" };

export default async function LoginPage() {
  if (await needsSetup()) redirect("/setup");
  if (await getUser()) redirect("/");
  const s = await getSettings();

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-brand-50 via-white to-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-lg">
          <div className="mb-6 flex flex-col items-center text-center">
            <BrandLogo logoUrl={s.logoUrl} name={s.storeName} className="mb-3 size-16 rounded-xl" />
            <h1 className="text-lg font-semibold">{s.storeName}</h1>
            <p className="text-sm text-slate-500">{s.tagline || "Sign in to continue"}</p>
          </div>
          <ActionForm action={login} className="space-y-4">
            <Field label="Username">
              <Input name="username" autoComplete="username" autoFocus required />
            </Field>
            <Field label="Password">
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>
            <SubmitButton className="w-full" pendingText="Signing in…">Sign in</SubmitButton>
          </ActionForm>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">{poweredBy()}</p>
      </div>
    </main>
  );
}
