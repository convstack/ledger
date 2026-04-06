import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getKey(): Buffer {
	const hex = process.env.ENCRYPTION_KEY;
	if (!hex || hex.length !== 64) {
		throw new Error(
			"ENCRYPTION_KEY must be a 64-character hex string (32 bytes)",
		);
	}
	return Buffer.from(hex, "hex");
}

/**
 * Encrypt a string using AES-256-GCM.
 * Returns a base64 string containing IV + auth tag + ciphertext.
 */
export function encrypt(plaintext: string): string {
	const key = getKey();
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);

	let encrypted = cipher.update(plaintext, "utf8", "base64");
	encrypted += cipher.final("base64");
	const authTag = cipher.getAuthTag();

	// Pack: iv (12 bytes) + authTag (16 bytes) + ciphertext
	const packed = Buffer.concat([iv, authTag, Buffer.from(encrypted, "base64")]);
	return packed.toString("base64");
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 */
export function decrypt(packed: string): string {
	const key = getKey();
	const buf = Buffer.from(packed, "base64");

	const iv = buf.subarray(0, 12);
	const authTag = buf.subarray(12, 28);
	const ciphertext = buf.subarray(28);

	const decipher = createDecipheriv("aes-256-gcm", key, iv);
	decipher.setAuthTag(authTag);

	let decrypted = decipher.update(ciphertext);
	decrypted = Buffer.concat([decrypted, decipher.final()]);
	return decrypted.toString("utf8");
}

/**
 * Encrypt a settings object.
 */
export function encryptSettings(settings: Record<string, string>): string {
	return encrypt(JSON.stringify(settings));
}

/**
 * Decrypt a settings object.
 */
export function decryptSettings(encrypted: string): Record<string, string> {
	return JSON.parse(decrypt(encrypted));
}
