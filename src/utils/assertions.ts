/**
 * Generic assertion helper for non-null type narrowing.
 * Throws an error with a descriptive message if the value is null or undefined.
 */
export function assert<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}
