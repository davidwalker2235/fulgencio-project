/**
 * Generate a random 5-character code using uppercase letters (A-Z) and numbers (0-9)
 * @returns {string} 5-character code
 */
export function generateUserCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
