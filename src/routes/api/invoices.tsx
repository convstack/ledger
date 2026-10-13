import { createFileRoute } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { db } from "~/db";
import { invoice, invoiceItem, ledgerAuditLog } from "~/db/schema";
import {
	getRequestCaller,
	getRequestUser,
	requireAnyPermission,
	requirePermission,
} from "~/lib/auth";
import { getUserEmail, sendEmail } from "~/lib/email";
import { nextInvoiceNumber } from "~/lib/invoice-number";
import { calculateTax } from "~/lib/tax";
import { resolveUserNames } from "~/lib/users";

export const Route = createFileRoute("/api/invoices")({
	server: {
		handlers: {
			/** @openapi
			 * summary: List all invoices
			 * auth: staff
			 * response: 200
			 *   columns: Array<{key: string, label: string}>
			 *   rows: Array<{id: string, invoiceNumber: string, user: string, status: string, amount: string, createdAt: string}>
			 *   total: number
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 */
			GET: async ({ request }: { request: Request }) => {
				const err = await requirePermission(request, "ledger:manage");
				if (err) return err;

				const { desc, eq } = await import("drizzle-orm");
				const { ledgerProvider } = await import("~/db/schema");

				const rows = await db
					.select({
						id: invoice.id,
						invoiceNumber: invoice.invoiceNumber,
						userId: invoice.userId,
						providerName: ledgerProvider.name,
						status: invoice.status,
						total: invoice.total,
						currency: invoice.currency,
						createdAt: invoice.createdAt,
					})
					.from(invoice)
					.leftJoin(ledgerProvider, eq(invoice.providerId, ledgerProvider.id))
					.orderBy(desc(invoice.createdAt))
					.limit(200);

				const userIds = rows.map((r) => r.userId);
				const nameMap = await resolveUserNames(userIds);

				return new Response(
					JSON.stringify({
						columns: [
							{ key: "invoiceNumber", label: "#" },
							{ key: "user", label: "User" },
							{ key: "provider", label: "Provider" },
							{ key: "status", label: "Status" },
							{ key: "amount", label: "Amount" },
							{ key: "createdAt", label: "Created" },
						],
						rows: rows.map((r) => ({
							id: r.id,
							invoiceNumber: r.invoiceNumber || "—",
							user: nameMap.get(r.userId) || r.userId,
							provider: r.providerName || "—",
							status: r.status,
							amount: `${(r.total / 100).toFixed(2)} ${r.currency}`,
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

			/** @openapi
			 * summary: Create a new invoice
			 * description: Needs ledger:invoices:create or ledger:manage, held by the user or granted to the calling service under Allowed Callers.
			 * auth: ledger:invoices:create or ledger:manage
			 * body:
			 *   userId: string (required) - Target user ID
			 *   items: Array<{description: string, quantity?: number, unitPrice: number, productId?: string}> (required) - Line items
			 *   currency: string - Currency code, defaults to EUR
			 *   notes: string - Invoice notes
			 *   dueDate: string - ISO date string
			 *   skipTax: boolean - Skip tax calculation
			 * response: 201
			 *   success: boolean
			 *   id: string
			 *   invoiceNumber: string
			 *   status: string
			 *   subtotal: number
			 *   tax: number
			 *   total: number
			 * error: 400 Invalid JSON
			 * error: 400 Validation error
			 * error: 401 Unauthorized
			 * error: 403 Forbidden
			 * error: 503 Service unavailable while lanyard can't be reached
			 */
			POST: async ({ request }: { request: Request }) => {
				const err = await requireAnyPermission(request, [
					"ledger:invoices:create",
					"ledger:manage",
				]);
				if (err) return err;
				const user = await getRequestUser(request);
				const caller = await getRequestCaller(request);

				let body: {
					userId: string;
					items: Array<{
						description: string;
						quantity?: number;
						unitPrice: number;
						productId?: string;
					}>;
					currency?: string;
					notes?: string;
					dueDate?: string;
					skipTax?: boolean;
				};
				try {
					body = await request.json();
				} catch {
					return new Response(JSON.stringify({ error: "Invalid JSON" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (!body.userId || !body.items?.length) {
					return new Response(
						JSON.stringify({
							error: "userId and at least one item are required",
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const currency = body.currency || "EUR";
				const invoiceId = nanoid();
				const invoiceNumber = await nextInvoiceNumber();
				const now = new Date();

				// Tag invoice with active provider
				const { ledgerProvider: lp } = await import("~/db/schema");
				const { eq: eqOp } = await import("drizzle-orm");
				const [activeProvider] = await db
					.select({ id: lp.id })
					.from(lp)
					.where(eqOp(lp.active, true))
					.limit(1);

				let subtotal = 0;
				const items = body.items.map((item) => {
					const qty = item.quantity || 1;
					const total = qty * item.unitPrice;
					subtotal += total;
					return {
						id: nanoid(),
						invoiceId,
						description: item.description,
						quantity: qty,
						unitPrice: item.unitPrice,
						total,
						productId: item.productId || null,
						createdAt: now,
					};
				});

				// Calculate tax unless explicitly skipped
				const { tax, total } = body.skipTax
					? { tax: 0, total: subtotal }
					: await calculateTax(subtotal);

				await db.insert(invoice).values({
					id: invoiceId,
					invoiceNumber,
					userId: body.userId,
					status: "pending",
					currency,
					subtotal,
					tax,
					total,
					providerId: activeProvider?.id || null,
					dueDate: body.dueDate ? new Date(body.dueDate) : null,
					notes: body.notes || null,
					createdBy: user?.id || "service",
					createdByService: caller?.slug ?? null,
					createdAt: now,
					updatedAt: now,
				});

				await db.insert(invoiceItem).values(items);

				await db.insert(ledgerAuditLog).values({
					id: nanoid(),
					action: "invoice.created",
					entityType: "invoice",
					entityId: invoiceId,
					userId: user?.id || "service",
					caller: caller?.slug ?? null,
					details: {
						invoiceNumber,
						itemCount: items.length,
						subtotal,
						tax,
						total,
					},
					createdAt: now,
				});

				// Send email notification
				const email = await getUserEmail(body.userId);
				if (email) {
					sendEmail({
						to: email,
						subject: `Invoice ${invoiceNumber}`,
						text: `You have a new invoice (${invoiceNumber}) for ${(total / 100).toFixed(2)} ${currency}. Please log in to view and pay.`,
					}).catch(() => {});
				}

				return new Response(
					JSON.stringify({
						success: true,
						id: invoiceId,
						invoiceNumber,
						status: "pending",
						subtotal,
						tax,
						total,
					}),
					{
						status: 201,
						headers: { "Content-Type": "application/json" },
					},
				);
			},
		},
	},
});
