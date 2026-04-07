import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { ledgerAuditLog } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";

export const Route = createFileRoute("/api/audit")({
	server: {
		handlers: {
			/** @openapi
			 * summary: List recent audit log entries
			 * auth: staff
			 * response: 200
			 *   columns: Array<{key: string, label: string}>
			 *   rows: Array<{id: string, action: string, entityType: string, entityId: string, userId: string, createdAt: string}>
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
					.select()
					.from(ledgerAuditLog)
					.orderBy(desc(ledgerAuditLog.createdAt))
					.limit(200);

				return new Response(
					JSON.stringify({
						columns: [
							{ key: "action", label: "Action" },
							{ key: "entityType", label: "Type" },
							{ key: "entityId", label: "Entity" },
							{ key: "userId", label: "By" },
							{ key: "createdAt", label: "Date" },
						],
						rows: rows.map((r) => ({
							id: r.id,
							action: r.action,
							entityType: r.entityType,
							entityId: r.entityId,
							userId: r.userId || "system",
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
