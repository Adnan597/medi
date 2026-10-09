import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, money, pkRange, todayPK } from "@/lib/format";
import { Button, Card, Empty, Field, Input, PageHeader, Table } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/action-form";
import { ComboboxInput } from "@/components/combobox-input";
import { Pager, pageOf } from "@/components/pager";
import { deleteExpense, saveExpense } from "@/app/actions/admin";

export const metadata = { title: "Expenses" };
const CATEGORIES = ["Rent", "Salary", "Electricity", "Gas", "Water", "Internet / Phone", "Maintenance", "Transport", "Tea / Refreshment", "Taxes & Fees", "Other"];
const PAGE_SIZE = 20;

export default async function ExpensesPage(props: PageProps<"/expenses">) {
  await requireUser("expenses");
  const sp = await props.searchParams;
  const today = todayPK();
  const from = typeof sp.from === "string" && sp.from ? sp.from : `${today.slice(0, 8)}01`;
  const to = typeof sp.to === "string" && sp.to ? sp.to : today;
  const page = pageOf(sp);
  const where = { date: pkRange(from, to) };

  const [expenses, byCat] = await Promise.all([
    db.expense.findMany({
      where,
      orderBy: { date: "desc" },
      include: { user: { select: { name: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
    }),
    db.expense.groupBy({ by: ["category"], where, _sum: { amount: true } }),
  ]);
  const total = byCat.reduce((s, c) => s + Number(c._sum.amount ?? 0), 0);

  return (
    <>
      <PageHeader title="Expenses" subtitle={<>Total in period: <b>{money(total)}</b></>} />
      <Card title="Add expense" className="mb-5">
        <ActionForm action={saveExpense} resetOnSuccess className="grid items-end gap-3 md:grid-cols-5">
          <Field label="Date"><Input name="date" type="date" defaultValue={today} /></Field>
          <Field label="Category">
            <ComboboxInput name="category" options={CATEGORIES} required placeholder="Select or type" />
          </Field>
          <Field label="Amount (Rs)"><Input name="amount" type="number" step="0.01" min={0} required /></Field>
          <Field label="Note"><Input name="note" /></Field>
          <SubmitButton>Add</SubmitButton>
        </ActionForm>
      </Card>

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="From"><Input type="date" name="from" defaultValue={from} /></Field>
        <Field label="To"><Input type="date" name="to" defaultValue={to} /></Field>
        <Button variant="secondary" type="submit">Filter</Button>
      </form>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table>
            <thead><tr><th>Date</th><th>Category</th><th>Note</th><th>By</th><th className="text-right!">Amount</th><th></th></tr></thead>
            <tbody>
              {expenses.length === 0 && <Empty colSpan={6}>No expenses</Empty>}
              {expenses.slice(0, PAGE_SIZE).map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.date)}</td>
                  <td>{e.category}</td>
                  <td className="text-slate-500">{e.note}</td>
                  <td>{e.user.name}</td>
                  <td className="text-right tabular-nums">{money(e.amount)}</td>
                  <td>
                    <form action={deleteExpense}>
                      <input type="hidden" name="id" value={e.id} />
                      <ConfirmButton message="Delete this expense?" variant="ghost">Delete</ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager page={page} hasMore={expenses.length > PAGE_SIZE} params={sp} />
        </div>
        <Card title="By category">
          <ul className="space-y-1.5 text-sm">
            {byCat.sort((a, b) => Number(b._sum.amount) - Number(a._sum.amount)).map((c) => (
              <li key={c.category} className="flex justify-between"><span>{c.category}</span><span className="tabular-nums">{money(c._sum.amount)}</span></li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
