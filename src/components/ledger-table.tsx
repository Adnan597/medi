import { fmtDateTime, money, num } from "@/lib/format";
import { Badge, Empty, Table } from "./ui";

type Entry = { id: string; createdAt: Date; type: string; amount: { toString(): string }; balance: { toString(): string }; note: string | null; user: { name: string } };

const LABELS: Record<string, string> = {
  PURCHASE: "Purchase",
  PURCHASE_RETURN: "Purchase return",
  SUPPLIER_PAYMENT: "Payment",
  CREDIT_SALE: "Credit sale",
  SALE_RETURN: "Sale return",
  CUSTOMER_PAYMENT: "Payment received",
  OPENING: "Opening",
  ADJUSTMENT: "Adjustment",
};

export function LedgerTable({ entries, balanceLabel }: { entries: Entry[]; balanceLabel: string }) {
  return (
    <Table>
      <thead>
        <tr><th>Date</th><th>Type</th><th>Detail</th><th>By</th><th className="text-right!">Debit (+)</th><th className="text-right!">Credit (−)</th><th className="text-right!">{balanceLabel}</th></tr>
      </thead>
      <tbody>
        {entries.length === 0 && <Empty colSpan={7}>No transactions yet</Empty>}
        {entries.map((e) => {
          const a = num(e.amount);
          return (
            <tr key={e.id}>
              <td className="text-slate-500">{fmtDateTime(e.createdAt)}</td>
              <td><Badge color={a > 0 ? "amber" : "green"}>{LABELS[e.type] ?? e.type}</Badge></td>
              <td className="text-slate-600">{e.note}</td>
              <td>{e.user.name}</td>
              <td className="text-right tabular-nums">{a > 0 ? money(a) : ""}</td>
              <td className="text-right tabular-nums">{a < 0 ? money(-a) : ""}</td>
              <td className="text-right font-medium tabular-nums">{money(e.balance)}</td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
