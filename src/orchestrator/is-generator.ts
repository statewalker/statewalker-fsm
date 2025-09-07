export function isGenerator(
  value: unknown,
): value is
  | Generator<string, void, unknown>
  | AsyncGenerator<string, void, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "next" in value &&
    typeof (value as Generator<string, void, unknown>).next === "function"
  );
}
