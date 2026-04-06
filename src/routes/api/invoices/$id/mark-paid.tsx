import { createFileRoute } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { db } from "~/db";
import { invoice, ledgerAuditLog, payment } from "~/db/schema";
import {
	getRequestUser,
	isServiceKeyRequest,
	requireLedgerManage,
} from "~/lib/auth";

export const Route = createFileRoute("/api/invoices/$id/mark-paid")({
	server: {
		handlers: {
			POST: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => {
				const user = getRequestUser(request);
				const isService = isServiceKeyRequest(request);

				if (!isService) {
					const err = requireLedgerManage(user);
					if (err) return err;
				}

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

				if (inv.status === "paid") {
					return new Response(
						JSON.stringify({ error: "Invoice is already paid" }),
						{ status: 400, headers: { "Content-Type": "application/json" } },
					);
				}

				const now = new Date();

				await db
					.update(invoice)
					.set({ status: "paid", paidAt: now, updatedAt: now })
					.where(eq(invoice.id, params.id));

				await db.insert(payment).values({
					id: nanoid(),
					invoiceId: params.id,
					amount: inv.total,
					currency: inv.currency,
					status: "succeeded",
					provider: "manual",
					method: "manual",
					createdAt: now,
				});

				await db.insert(ledgerAuditLog).values({
					id: nanoid(),
					action: "payment.succeeded",
					entityType: "invoice",
					entityId: params.id,
					userId: user?.id || "service",
					details: { method: "manual", amount: inv.total },
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
