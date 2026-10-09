import { Sidebar } from "@/components/sidebar";
import { PERMISSIONS, can, requireUser, type Permission } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { logout } from "@/app/actions/auth";
import { APP_NAME } from "@/lib/brand";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const settings = await getSettings();
  const allowed = (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(user.role, p));

  return (
    <div className="min-h-screen">
      <Sidebar
        user={{ name: user.name, role: user.role }}
        allowed={allowed}
        storeName={settings.storeName}
        tagline={settings.tagline}
        logoUrl={settings.logoUrl}
        appName={APP_NAME}
        logout={logout}
      />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1400px] p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
