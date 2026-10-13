import { beforeEach, describe, expect, it, vi } from "vitest";
import { handlers } from "../support/route";

interface Invoice {
	id: string;
	status: string;
	total: number;
	currency: string;
	paidAt: Date | null;
	createdByService: string | null;
}

let who: { perms: string[]; service: string | null };
let invoices: Invoice[];
const updated: unknown[] = [];

const invoice = { __table: "invoice", id: "id" };
const invoiceItem = { __table: "invoice_item", invoiceId: "invoiceId" };

vi.mock("~/lib/auth", () => {
	const refuse = () =>
		new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
	return {
		hasPermission: async (_request: Request, permission: string) =>
			who.perms.includes(permission),
		getRequestCaller: async () => (who.service ? { slug: who.service } : null),
		getRequestUser: async () => ({ id: "user-1" }),
		requirePermission: async (_request: Request, permission: string) =>
			who.perms.includes(permission) ? null : refuse(),
		requireAnyPermission: async (_request: Request, permissions: string[]) =>
			permissions.some((p) => who.perms.includes(p)) ? null : refuse(),
	};
});
vi.mock("drizzle-orm", () => ({
	eq: (_column: unknown, value: unknown) => value,
}));
vi.mock("nanoid", () => ({ nanoid: () => "new-id" }));
vi.mock("~/db/schema", () => ({
	invoice,
	invoiceItem,
	payment: { __table: "payment" },
	ledgerAuditLog: { __table: "audit" },
}));
vi.mock("~/db", () => ({
	db: {
		select: () => ({
			from: (table: { __table: string }) => ({
				where: (id: string) => {
					const rows =
						table.__table === "invoice"
							? invoices.filter((i) => i.id === id)
							: [
									{
										id: "item-1",
										description: "Badge",
										quantity: 1,
										unitPrice: 1000,
										total: 1000,
									},
								];
					return Object.assign(Promise.resolve(rows), {
						limit: async () => rows,
					});
				},
			}),
		}),
		update: () => ({
			set: (values: unknown) => ({
				where: async () => {
					updated.push(values);
				},
			}),
		}),
		insert: () => ({ values: async () => undefined }),
	},
}));

const inv = (id: string, createdByService: string | null): Invoice => ({
	id,
	status: "pending",
	total: 1000,
	currency: "EUR",
	paidAt: null,
	createdByService,
});

const params = (id: string) => ({ params: { id } });
const request = () => new Request("http://x", { method: "POST" });

const status = async (id: string) => {
	const { Route } = await import("~/routes/api/invoices/$id/status");
	return (
		await handlers(Route).GET({
			request: request(),
			...params(id),
		})
	).status;
};
const markPaid = async (id: string) => {
	const { Route } = await import("~/routes/api/invoices/$id/mark-paid");
	return (
		await handlers(Route).POST({
			request: request(),
			...params(id),
		})
	).status;
};
const items = async (id: string) => {
	const { Route } = await import("~/routes/api/invoices/$id/items");
	return (
		await handlers(Route).GET({
			request: request(),
			...params(id),
		})
	).status;
};

beforeEach(() => {
	who = { perms: [], service: null };
	invoices = [
		inv("guidebook-owned", "guidebook"),
		inv("schedule-owned", "schedule"),
		inv("legacy", null),
	];
	updated.length = 0;
});

describe("invoice status", () => {
	beforeEach(() => {
		who = { perms: ["ledger:invoices:status"], service: "guidebook" };
	});

	it("is readable by the service that created the invoice", async () => {
		expect(await status("guidebook-owned")).toBe(200);
	});

	it("is not readable by another service", async () => {
		expect(await status("schedule-owned")).toBe(404);
	});

	it("is not readable on an invoice with no creating service", async () => {
		expect(await status("legacy")).toBe(404);
	});

	it("is not readable by a person holding only the narrow permission", async () => {
		who = { perms: ["ledger:invoices:status"], service: null };
		expect(await status("guidebook-owned")).toBe(404);
	});

	it("is readable on any invoice by ledger:manage", async () => {
		who = { perms: ["ledger:manage"], service: null };
		expect(await status("schedule-owned")).toBe(200);
		expect(await status("legacy")).toBe(200);
	});

	it("is readable on any invoice by a service holding ledger:manage", async () => {
		who = { perms: ["ledger:manage"], service: "guidebook" };
		expect(await status("schedule-owned")).toBe(200);
	});

	it("is refused without either permission", async () => {
		who = { perms: [], service: "guidebook" };
		expect(await status("guidebook-owned")).toBe(403);
	});
});

describe("invoice mark-paid", () => {
	beforeEach(() => {
		who = { perms: ["ledger:invoices:mark-paid"], service: "guidebook" };
	});

	it("lets a service pay its own invoice", async () => {
		expect(await markPaid("guidebook-owned")).toBe(200);
		expect(updated).toHaveLength(1);
	});

	it("doesn't let a service pay another service's invoice", async () => {
		expect(await markPaid("schedule-owned")).toBe(404);
		expect(updated).toHaveLength(0);
	});

	it("doesn't let a service pay an invoice with no creating service", async () => {
		expect(await markPaid("legacy")).toBe(404);
		expect(updated).toHaveLength(0);
	});

	it("lets ledger:manage pay any invoice", async () => {
		who = { perms: ["ledger:manage"], service: null };
		expect(await markPaid("schedule-owned")).toBe(200);
		expect(updated).toHaveLength(1);
	});

	it("refuses an invoice that is already paid", async () => {
		invoices = [{ ...inv("guidebook-owned", "guidebook"), status: "paid" }];
		expect(await markPaid("guidebook-owned")).toBe(400);
		expect(updated).toHaveLength(0);
	});
});

describe("invoice items", () => {
	it("are refused to a service holding only a narrow permission", async () => {
		who = { perms: ["ledger:invoices:status"], service: "guidebook" };
		expect(await items("guidebook-owned")).toBe(403);
	});

	it("are refused to someone with no ledger permission", async () => {
		expect(await items("guidebook-owned")).toBe(403);
	});

	it("are readable with ledger:manage", async () => {
		who = { perms: ["ledger:manage"], service: null };
		expect(await items("guidebook-owned")).toBe(200);
	});
});
