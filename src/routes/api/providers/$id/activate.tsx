import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db";
import { ledgerProvider } from "~/db/schema";
import { getRequestUser, requireLedgerManage } from "~/lib/auth";

export const Route = createFileRoute("/api/providers/$id/activate")({
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
				const err = requireLedgerManage(user);
				if (err) return err;

				const { eq } = await import("drizzle-orm");

				// Deactivate all providers first
				await db
					.update(ledgerProvider)
					.set({ active: false, updatedAt: new Date() });

				// Activate this one
				await db
					.update(ledgerProvider)
					.set({ active: true, updatedAt: new Date() })
					.where(eq(ledgerProvider.id, params.id));

				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
