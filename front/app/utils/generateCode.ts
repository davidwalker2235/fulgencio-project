/**
 * Generate a 5-letter deterministic code from an email using SHA-256 and base-26 A-Z encoding.
 * Works in both Node.js and browser environments.
 *
 * @param {string} email
 * @returns {Promise<string>} 5 uppercase letters A–Z
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

  // Step 5: Convert to base-26 (A-Z), 5 chars
  const letters: string[] = [];
  const codeLength = 5;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let i = 0; i < codeLength; ++i) {
    // Use Math.floor as BigInt is not available in ES2019 environments; do not use 26n
    // Use regular Number instead of BigInt division/modulo, for compatibility.
    const rem = Number(num % BigInt(26)); // Always integer 0..25
    letters.push(alphabet[rem]);
    num = num / BigInt(26);
  }
  // The loop generates chars LSB-first, reverse for human order:
  return letters.reverse().join("");
}
