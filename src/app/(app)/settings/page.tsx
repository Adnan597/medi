import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Card, PageHeader } from "@/components/ui";
import { SettingsForm, UserForm } from "./forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireUser("settings");
  const [s, users] = await Promise.all([getSettings(), db.user.findMany({ orderBy: { createdAt: "asc" } })]);

  return (
    <>
      <PageHeader title="Settings" />
      <Card title="Pharmacy profile & branding" className="mb-5">
        <SettingsForm s={s} />
      </Card>
      <Card title="Users & roles">
        <p className="mb-4 text-sm text-slate-500">
          <b>Admin</b>: everything. <b>Pharmacist</b>: sales, medicines, purchases, stock, suppliers (no reports/settings). <b>Cashier</b>: POS, own sales and customers only; can&apos;t see cost or profit.
        </p>
        <div className="space-y-4">
          {users.map((u) => (
            <div key={u.id} className="border-b border-slate-100 pb-4">
              <UserForm u={{ id: u.id, name: u.name, username: u.username, role: u.role, active: u.active }} />
            </div>
          ))}
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-700">Add new user</p>
            <UserForm />
          </div>
        </div>
      </Card>
    </>
  );
}
