/**
 * Generate a 5-character deterministic code from an email using SHA-256 and base-36 encoding.
 * Works in both Node.js and browser environments.
 * Same email will always generate the same code.
 *
 * @param {string} email
 * @returns {Promise<string>} 5 characters (A-Z, 0-9)
 */
export async function generateCode(email: string): Promise<string> {
  // Step 1-2: Normalize email
  const normalized = email.toLowerCase().trim();

  // Step 3: SHA-256 hash
  let hashBuffer: ArrayBuffer | Uint8Array;
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    // Browser: use crypto.subtle
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  } else {
    // Node.js: use crypto.createHash
    const crypto = await import("crypto");
    hashBuffer = crypto.createHash("sha256").update(normalized).digest();
  }

  // Step 4: Convert hash (Uint8Array/Buffer) to BigInt
  let hex = "";
  if (typeof ArrayBuffer !== "undefined" && hashBuffer instanceof ArrayBuffer) {
    hex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } else {
    // Node.js Buffer or Uint8Array
    // Supporting both Buffer and Uint8Array (Buffer.isBuffer() will be true for Buffer)
    // but Buffer may not exist in some environments, so fall back for Uint8Array.
    if (
      typeof Buffer !== "undefined" &&
      typeof (Buffer as any).isBuffer === "function" &&
      (Buffer as any).isBuffer(hashBuffer)
    ) {
      hex = (hashBuffer as Buffer).toString("hex");
    } else if (
      hashBuffer instanceof Uint8Array // Handles browser and fallback
    ) {
      hex = Array.from(hashBuffer)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } else {
      throw new Error("Unsupported hashBuffer type");
    }
  }
  let num = BigInt("0x" + hex);

  // Step 5: Convert to base-36 (A-Z, 0-9), 5 chars
  const chars: string[] = [];
  const codeLength = 5;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; // Base-36: A-Z and 0-9
  for (let i = 0; i < codeLength; ++i) {
    const rem = Number(num % BigInt(36)); // Always integer 0..35
    chars.push(alphabet[rem]);
    num = num / BigInt(36);
  }
  // The loop generates chars LSB-first, reverse for human order:
  return chars.reverse().join("");
}
