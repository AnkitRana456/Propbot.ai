/**
 * Utility for compile-time exhaustive checks on discriminated unions.
 *
 * @param value The value that should have been narrowed to `never`
 * @param message Optional custom error message
 * @throws Error if reached at runtime
 */
export function assertNever(value: never, message = 'Unexpected union value'): never {
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}
