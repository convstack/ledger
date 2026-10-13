import { createFileRoute } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { db } from "~/db";
import { invoice, ledgerAuditLog, payment } from "~/db/schema";
import {
	getRequestCaller,
	getRequestUser,
	requireAnyPermission,
} from "~/lib/auth";
import { mayActOnInvoice } from "~/lib/invoice-access";

export const Route = createFileRoute("/api/invoices/$id/mark-paid")({
	server: {
		handlers: {
			/** @openapi
			 * summary: Mark an invoice as paid manually
			 * description: Needs ledger:invoices:mark-paid or ledger:manage, held by the user or granted to the calling service under Allowed Callers. The narrow permission only covers invoices the calling service created.
			 * auth: ledger:invoices:mark-paid or ledger:manage
			 * response: 200
			 *   success: boolean
			 * error: 400 Invoice is already paid
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 * error: 404 Invoice not found
			 * error: 503 Service unavailable while lanyard can't be reached
			 */
			POST: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => {
				const err = await requireAnyPermission(request, [
					"ledger:invoices:mark-paid",
					"ledger:manage",
				]);
				if (err) return err;
				const user = await getRequestUser(request);
				const caller = await getRequestCaller(request);

				const { eq } = await import("drizzle-orm");

				const [inv] = await db
					.select()
					.from(invoice)
					.where(eq(invoice.id, params.id))
					.limit(1);

				if (!inv || !(await mayActOnInvoice(request, inv.createdByService))) {
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
					caller: caller?.slug ?? null,
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
