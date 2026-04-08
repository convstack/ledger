import { createFileRoute } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { db } from "~/db";
import { invoice, ledgerAuditLog, payment } from "~/db/schema";
import { getRequestUser, requireServiceOrPermission } from "~/lib/auth";
import { getActiveProvider } from "~/lib/providers/registry";

export const Route = createFileRoute("/api/invoices/$id/refund")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Refund a paid invoice
			 * auth: staff
			 * response: 200
			 *   success: boolean
			 * error: 400 Only paid invoices can be refunded
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 * error: 404 Invoice not found
			 */
			POST: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => {
				const user = getRequestUser(request);
				const err = await requireServiceOrPermission(request, "ledger:manage");
				if (err) return err;

				const { eq } = await import("drizzle-orm");

				const [inv] = await db
					.select()
					.from(invoice)
					.where(eq(invoice.id, params.id))
					.limit(1);

				if (!inv) {
					return new Response(JSON.stringify({ error: "Invoice not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (inv.status !== "paid") {
					return new Response(
						JSON.stringify({
							error: "Only paid invoices can be refunded",
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const provider = await getActiveProvider();
				if (provider?.refundPayment) {
					await provider.refundPayment({
						id: inv.id,
						userId: inv.userId,
						total: inv.total,
						currency: inv.currency,
						items: [],
						providerRef: inv.providerRef,
					});
				}

				const now = new Date();
				await db
					.update(invoice)
					.set({ status: "refunded", updatedAt: now })
					.where(eq(invoice.id, params.id));

				await db.insert(payment).values({
					id: nanoid(),
					invoiceId: params.id,
					amount: -inv.total,
					currency: inv.currency,
					status: "refunded",
					provider: provider?.type || "manual",
					method: "refund",
					createdAt: now,
				});

				await db.insert(ledgerAuditLog).values({
					id: nanoid(),
					action: "invoice.refunded",
					entityType: "invoice",
					entityId: params.id,
					userId: user?.id || "system",
					details: { amount: inv.total },
					createdAt: now,
				});

				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
