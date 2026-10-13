import { getRequestCaller, hasPermission } from "~/lib/auth";

// ledger:manage covers every invoice; a narrow grant only the ones its own service created
export async function mayActOnInvoice(
	request: Request,
	createdByService: string | null,
): Promise<boolean> {
	if (await hasPermission(request, "ledger:manage")) return true;
	const caller = await getRequestCaller(request);
	return (
		caller !== null &&
		createdByService !== null &&
		caller.slug === createdByService
	);
}
