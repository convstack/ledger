import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProviderCapabilities } from "./providers/types";
import type { UIManifest } from "./types";

const { version } = JSON.parse(
	readFileSync(join(process.cwd(), "package.json"), "utf-8"),
);

/**
 * Build the ledger manifest dynamically based on active provider capabilities.
 * Pages gated by capabilities are conditionally included.
 */
export function buildLedgerManifest(
	capabilities: ProviderCapabilities | null,
): UIManifest {
	const pages: unknown[] = [
		// Admin overview
		{
			path: "/",
			title: "Ledger Overview",
			layout: "default",
			requiredPermission: "ledger:manage",
			sections: [
				{
					type: "data-table",
					endpoint: "/api/invoices",
					config: {
						title: "Recent Invoices",
						rowLink: "/invoices/:id",
						readOnly: true,
					},
				},
			],
		},
		// Provider management
		{
			path: "/providers",
			title: "Payment Providers",
			layout: "default",
			showBack: true,
			requiredPermission: "ledger:manage",
			sections: [
				{
					type: "data-table",
					endpoint: "/api/providers",
					config: {
						rowLink: "/providers/:id",
						createLink: "/providers/new",
						createLabel: "Add Provider",
					},
				},
			],
		},
		{
			path: "/providers/new",
			title: "Add Provider",
			layout: "default",
			showBack: true,
			requiredPermission: "ledger:manage",
			sections: [
				{
					type: "form",
					endpoint: "/api/providers",
					config: {
						fields: [
							{
								key: "type",
								label: "Provider Type",
								type: "select",
								required: true,
								options: [
									{ label: "Stripe", value: "stripe" },
									{ label: "Manual", value: "manual" },
								],
							},
							{
								key: "name",
								label: "Display Name",
								type: "text",
								required: true,
								placeholder: "e.g. Stripe Production",
							},
						],
						submitLabel: "Create Provider",
					},
				},
			],
		},
		{
			path: "/providers/:id",
			title: "Provider",
			layout: "default",
			showBack: true,
			requiredPermission: "ledger:manage",
			sections: [
				{
					type: "detail",
					endpoint: "/api/providers/:id",
					config: { title: "Provider Details" },
				},
				{
					type: "form",
					endpoint: "/api/providers/:id/settings",
					config: {
						title: "Provider Settings",
						method: "PUT",
						submitEndpoint: "/api/providers/:id",
						submitLabel: "Save Settings",
						fields: [{ key: "_", label: "_", type: "text" }],
					},
				},
				{
					type: "action-bar",
					endpoint: "/api/providers/:id/actions",
					config: {},
				},
			],
		},
		// Products
		{
			path: "/products",
			title: "Products",
			layout: "default",
			showBack: true,
			requiredPermission: "ledger:manage",
			sections: [
				{
					type: "data-table",
					endpoint: "/api/products",
					config: {
						rowLink: "/products/:id",
						createLink: "/products/new",
						createLabel: "New Product",
					},
				},
			],
		},
		{
			path: "/products/new",
			title: "New Product",
			layout: "default",
			showBack: true,
			requiredPermission: "ledger:manage",
			sections: [
				{
					type: "form",
					endpoint: "/api/products",
					config: {
						fields: [
							{
								key: "name",
								label: "Name",
								type: "text",
								required: true,
							},
							{
								key: "description",
								label: "Description",
								type: "textarea",
							},
							{
								key: "price",
								label: "Price (cents)",
								type: "number",
								required: true,
								placeholder: "e.g. 5000 for 50.00",
							},
							{
								key: "currency",
								label: "Currency",
								type: "text",
								required: true,
								placeholder: "EUR",
							},
							{
								key: "type",
								label: "Type",
								type: "select",
								required: true,
								options: [
									{ label: "One-time", value: "one-time" },
									{ label: "Recurring", value: "recurring" },
								],
							},
							{
								key: "interval",
								label: "Billing Interval",
								type: "select",
								options: [
									{ label: "None (one-time)", value: "" },
									{ label: "Monthly", value: "month" },
									{ label: "Yearly", value: "year" },
								],
							},
							{
								key: "prorateOnChange",
								label: "Prorate on upgrade/downgrade",
								type: "select",
								options: [
									{ label: "No", value: "false" },
									{ label: "Yes", value: "true" },
								],
							},
						],
						submitLabel: "Create Product",
					},
				},
			],
		},
		{
			path: "/products/:id",
			title: "Product",
			layout: "default",
			showBack: true,
			requiredPermission: "ledger:manage",
			sections: [
				{
					type: "detail",
					endpoint: "/api/products/:id",
					config: { title: "Product Details" },
				},
				{
					type: "form",
					endpoint: "/api/products/:id",
					config: {
						title: "Edit Product",
						method: "PUT",
						fields: [
							{ key: "name", label: "Name", type: "text", required: true },
							{ key: "description", label: "Description", type: "textarea" },
							{
								key: "price",
								label: "Price (cents)",
								type: "number",
								required: true,
							},
							{ key: "currency", label: "Currency", type: "text" },
							{
								key: "type",
								label: "Type",
								type: "select",
								options: [
									{ label: "One-time", value: "one-time" },
									{ label: "Recurring", value: "recurring" },
								],
							},
							{
								key: "interval",
								label: "Interval",
								type: "select",
								options: [
									{ label: "None", value: "" },
									{ label: "Monthly", value: "month" },
									{ label: "Yearly", value: "year" },
								],
							},
						],
						submitLabel: "Save Product",
					},
				},
				{
					type: "action-bar",
					endpoint: "/api/products/:id/actions",
					config: {},
				},
			],
		},
		// All invoices (admin)
		{
			path: "/invoices",
			title: "All Invoices",
			layout: "default",
			showBack: true,
			requiredPermission: "ledger:manage",
			sections: [
				{
					type: "data-table",
					endpoint: "/api/invoices",
					config: {
						rowLink: "/invoices/:id",
						readOnly: true,
					},
				},
			],
		},
		{
			path: "/invoices/:id",
			title: "Invoice",
			layout: "default",
			showBack: true,
			requiredPermission: "ledger:manage",
			sections: [
				{
					type: "detail",
					endpoint: "/api/invoices/:id",
					config: { title: "Invoice Details" },
				},
				{
					type: "data-table",
					endpoint: "/api/invoices/:id/items",
					config: { title: "Line Items", readOnly: true },
				},
				{
					type: "action-bar",
					endpoint: "/api/invoices/:id/actions",
					config: {},
				},
			],
		},
		// User-facing: My Invoices
		{
			path: "/my/invoices",
			title: "My Invoices",
			layout: "default",
			sections: [
				{
					type: "data-table",
					endpoint: "/api/my/invoices",
					config: {
						rowLink: "/my/invoices/:id",
						readOnly: true,
					},
				},
			],
		},
		{
			path: "/my/invoices/:id",
			title: "Invoice",
			layout: "default",
			showBack: true,
			sections: [
				{
					type: "detail",
					endpoint: "/api/my/invoices/:id",
					config: { title: "Invoice Details" },
				},
				{
					type: "data-table",
					endpoint: "/api/my/invoices/:id/items",
					config: { title: "Line Items", readOnly: true },
				},
				{
					type: "action-bar",
					endpoint: "/api/my/invoices/:id/actions",
					config: {},
				},
			],
		},
		// Settings
		{
			path: "/settings",
			title: "Ledger Settings",
			layout: "default",
			showBack: true,
			requiredPermission: "ledger:manage",
			sections: [
				{
					type: "form",
					endpoint: "/api/settings",
					config: {
						title: "Settings",
						method: "PUT",
						fields: [
							{
								key: "defaultCurrency",
								label: "Default Currency",
								type: "text",
								required: true,
							},
							{
								key: "taxRate",
								label: "Tax Rate (basis points, e.g. 1900 = 19%)",
								type: "number",
							},
							{
								key: "taxLabel",
								label: "Tax Label",
								type: "text",
								placeholder: "VAT",
							},
							{
								key: "dataRetentionDays",
								label: "Data Retention (days)",
								type: "number",
								required: true,
							},
							{
								key: "allowSelfCancel",
								label: "Allow users to cancel subscriptions",
								type: "select",
								options: [
									{ label: "Yes", value: "true" },
									{ label: "No", value: "false" },
								],
							},
							{
								key: "smtpHost",
								label: "SMTP Host",
								type: "text",
								placeholder: "smtp.example.com",
							},
							{
								key: "smtpPort",
								label: "SMTP Port",
								type: "number",
								placeholder: "587",
							},
							{
								key: "smtpUser",
								label: "SMTP User",
								type: "text",
							},
							{
								key: "smtpPass",
								label: "SMTP Password",
								type: "password",
							},
							{
								key: "smtpFrom",
								label: "From Address",
								type: "text",
								placeholder: "billing@example.com",
							},
						],
						submitLabel: "Save Settings",
					},
				},
			],
		},
		// Payments
		{
			path: "/payments",
			title: "Payment History",
			layout: "default",
			showBack: true,
			requiredPermission: "ledger:manage",
			sections: [
				{
					type: "data-table",
					endpoint: "/api/payments",
					config: { readOnly: true },
				},
			],
		},
		// Audit log
		{
			path: "/audit",
			title: "Audit Log",
			layout: "default",
			showBack: true,
			requiredPermission: "ledger:manage",
			sections: [
				{
					type: "data-table",
					endpoint: "/api/audit",
					config: { readOnly: true },
				},
			],
		},
		// Webhook subscribers
		{
			path: "/webhooks/subscribers",
			title: "Webhook Subscribers",
			layout: "default",
			showBack: true,
			requiredPermission: "ledger:manage",
			sections: [
				{
					type: "data-table",
					endpoint: "/api/webhooks/subscribers",
					config: {
						rowLink: "/webhooks/subscribers/:id",
						createLink: "/webhooks/subscribers/new",
						createLabel: "Add Subscriber",
					},
				},
			],
		},
		{
			path: "/webhooks/subscribers/new",
			title: "Add Webhook Subscriber",
			layout: "default",
			showBack: true,
			requiredPermission: "ledger:manage",
			sections: [
				{
					type: "form",
					endpoint: "/api/webhooks/subscribers",
					config: {
						fields: [
							{
								key: "name",
								label: "Name",
								type: "text",
								required: true,
								placeholder: "e.g. Hosting Panel",
							},
							{
								key: "url",
								label: "Callback URL",
								type: "text",
								required: true,
								placeholder: "https://example.com/api/webhooks/ledger",
							},
							{
								key: "secret",
								label: "Secret (auto-generated if empty)",
								type: "password",
								placeholder: "leave empty to auto-generate",
							},
							{
								key: "events",
								label: "Events (comma-separated, or * for all)",
								type: "text",
								placeholder: "subscription.paid, subscription.cancelled",
							},
						],
						submitLabel: "Create Subscriber",
					},
				},
			],
		},
		{
			path: "/webhooks/subscribers/:id",
			title: "Webhook Subscriber",
			layout: "default",
			showBack: true,
			requiredPermission: "ledger:manage",
			sections: [
				{
					type: "detail",
					endpoint: "/api/webhooks/subscribers/:id",
					config: { title: "Subscriber Details" },
				},
				{
					type: "form",
					endpoint: "/api/webhooks/subscribers/:id",
					config: {
						title: "Edit Subscriber",
						method: "PUT",
						fields: [
							{ key: "name", label: "Name", type: "text" },
							{ key: "url", label: "Callback URL", type: "text" },
							{
								key: "events",
								label: "Events (comma-separated)",
								type: "text",
							},
						],
						submitLabel: "Save",
					},
				},
				{
					type: "action-bar",
					endpoint: "/api/webhooks/subscribers/:id/actions",
					config: {},
				},
			],
		},
	];

	// Conditionally add subscription pages
	if (capabilities?.subscriptions) {
		pages.push(
			{
				path: "/subscriptions",
				title: "Subscriptions",
				layout: "default",
				showBack: true,
				requiredPermission: "ledger:manage",
				sections: [
					{
						type: "data-table",
						endpoint: "/api/subscriptions",
						config: { rowLink: "/subscriptions/:id", readOnly: true },
					},
				],
			},
			{
				path: "/subscriptions/:id",
				title: "Subscription",
				layout: "default",
				showBack: true,
				requiredPermission: "ledger:manage",
				sections: [
					{
						type: "detail",
						endpoint: "/api/subscriptions/:id",
						config: { title: "Subscription Details" },
					},
					{
						type: "action-bar",
						endpoint: "/api/subscriptions/:id/actions",
						config: {},
					},
				],
			},
			{
				path: "/my/subscriptions",
				title: "My Subscriptions",
				layout: "default",
				sections: [
					{
						type: "data-table",
						endpoint: "/api/my/subscriptions",
						config: {
							rowLink: "/my/subscriptions/:id",
							readOnly: true,
						},
					},
				],
			},
			{
				path: "/my/subscriptions/:id",
				title: "Subscription",
				layout: "default",
				showBack: true,
				sections: [
					{
						type: "detail",
						endpoint: "/api/my/subscriptions/:id",
						config: { title: "Subscription Details" },
					},
					{
						type: "action-bar",
						endpoint: "/api/my/subscriptions/:id/actions",
						config: {},
					},
				],
			},
		);
	}

	const sidebarItems = [
		{ label: "Overview", path: "/", icon: "layout-dashboard" },
		{ label: "My Invoices", path: "/my/invoices", icon: "receipt" },
	];

	if (capabilities?.subscriptions) {
		sidebarItems.push({
			label: "My Subscriptions",
			path: "/my/subscriptions",
			icon: "refresh-cw",
		});
	}

	const sidebarFooter = [
		{ label: "Providers", path: "/providers", icon: "settings" },
		{ label: "Products", path: "/products", icon: "package" },
		{ label: "All Invoices", path: "/invoices", icon: "file-text" },
		{ label: "Payments", path: "/payments", icon: "credit-card" },
		{ label: "Audit Log", path: "/audit", icon: "scroll-text" },
		{ label: "Webhooks", path: "/webhooks/subscribers", icon: "webhook" },
		{ label: "Settings", path: "/settings", icon: "sliders-horizontal" },
	];

	if (capabilities?.subscriptions) {
		sidebarFooter.splice(3, 0, {
			label: "Subscriptions",
			path: "/subscriptions",
			icon: "refresh-cw",
		});
	}

	return {
		name: "Ledger",
		icon: "credit-card",
		version,
		navigation: [{ label: "Ledger", path: "/", icon: "credit-card" }],
		sidebar: {
			items: sidebarItems,
			footerItems: sidebarFooter,
		},
		widgets: [],
		pages,
		permissions: ["ledger:manage"],
	};
}
