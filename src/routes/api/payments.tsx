import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { payment } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";

export const Route = createFileRoute("/api/payments")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				const user = getRequestUser(request);
				const err = requireLedgerManage(user);
				if (err) return err;

				const { desc } = await import("drizzle-orm");

				const rows = await db
					.select()
					.from(payment)
					.orderBy(desc(payment.createdAt))
					.limit(200);

				return new Response(
					JSON.stringify({
						columns: [
							{ key: "invoiceId", label: "Invoice" },
							{ key: "amount", label: "Amount" },
							{ key: "status", label: "Status" },
							{ key: "provider", label: "Provider" },
							{ key: "method", label: "Method" },
							{ key: "createdAt", label: "Date" },
						],
						rows: rows.map((r) => ({
							id: r.id,
							invoiceId: r.invoiceId,
							amount: `${(r.amount / 100).toFixed(2)} ${r.currency}`,
							status: r.status,
							provider: r.provider,
							method: r.method || "—",
							createdAt: r.createdAt?.toISOString(),
						})),
						total: rows.length,
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			},
		},
	},
});
