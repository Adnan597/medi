import { requireUser } from "@/lib/auth";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { changePassword } from "@/app/actions/auth";

export const metadata = { title: "My Account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="My Account" subtitle={`${user.name} · @${user.username} · ${user.role.toLowerCase()}`} />
      <Card title="Change password" className="max-w-md">
        <ActionForm action={changePassword} resetOnSuccess className="space-y-3">
          <Field label="Current password"><Input name="current" type="password" required autoComplete="current-password" /></Field>
          <Field label="New password"><Input name="next" type="password" required minLength={6} autoComplete="new-password" /></Field>
          <SubmitButton>Change password</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
