import { createFileRoute } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { db } from "~/db";
import { invoice, invoiceItem, ledgerAuditLog } from "~/db/schema";
import {
	getRequestUser,
	requireLedgerManage,
	validateServiceKey,
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
				const user = getRequestUser(request);
				const err = requireLedgerManage(user);
				if (err) return err;

				const { desc } = await import("drizzle-orm");

				const rows = await db
					.select({
						id: invoice.id,
						invoiceNumber: invoice.invoiceNumber,
						userId: invoice.userId,
						status: invoice.status,
						total: invoice.total,
						currency: invoice.currency,
						createdAt: invoice.createdAt,
					})
					.from(invoice)
					.orderBy(desc(invoice.createdAt))
					.limit(200);

				const userIds = rows.map((r) => r.userId);
				const nameMap = await resolveUserNames(userIds);

				return new Response(
					JSON.stringify({
						columns: [
							{ key: "invoiceNumber", label: "#" },
							{ key: "user", label: "User" },
							{ key: "status", label: "Status" },
							{ key: "amount", label: "Amount" },
							{ key: "createdAt", label: "Created" },
						],
						rows: rows.map((r) => ({
							id: r.id,
							invoiceNumber: r.invoiceNumber || "—",
							user: nameMap.get(r.userId) || r.userId,
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
			 * auth: staff
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
			 */
			POST: async ({ request }: { request: Request }) => {
				const user = getRequestUser(request);
				const isService = await validateServiceKey(request);

				if (!isService) {
					const err = requireLedgerManage(user);
					if (err) return err;
				}

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
					dueDate: body.dueDate ? new Date(body.dueDate) : null,
					notes: body.notes || null,
					createdBy: user?.id || "service",
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
