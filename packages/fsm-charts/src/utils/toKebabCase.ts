export function toKebabCase(str?: string): string {
  // Remove spaces:
  str = (str || "").trim().replace(/\s+/gim, "-");
  // Transform to kebab:
  str = str.replace(
    /([^A-Z]?)([A-Z])/g,
    (_, a, b) => `${a.toLowerCase()}-${b.toLowerCase()}`,
  );
  return str;

  // return (
  //   str.match(
  //     /[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g
  //   ) || []
  // )
  //   .join("-")
  //   .toLowerCase();
}
