/**
 * Resolve module paths relative to a base URL.
 * This is useful for converting relative paths to absolute URLs.
 *
 * @param baseUrl - The base URL to resolve against.
 * @param refs - An array of module references (relative or absolute).
 * @returns An array of resolved absolute module URLs as strings.
 * @example
 * ```ts
 * const urls = resolveModulesUrls(
 *  'file:///home/user/project/', // base URL
 *  'https://example.com/js/my-module.js', // absolute URL
 *  './module1.js', // relative path
 *  '../module2.js' // relative path
 * );
 * console.log(urls);
 * // Output: [
 * //  'https://example.com/js/my-module.js',
 * //  'file:///home/user/project/module1.js',
 * //  'file:///home/user/module2.js'
 * // ] *
 * ```
 */
export function resolveModulesUrls(
  baseUrl: URL | string,
  ...refs: (URL | string)[]
): string[] {
  return refs.map((ref) => new URL(ref, baseUrl).href);
}

/**
 * Resolves module paths relative to a base URL.
 * This is useful for converting relative paths to absolute file system paths.
 * @param baseUrl - The base URL to resolve against
 * @param refs - An array of module references (relative or absolute)
 * @returns - An array of resolved absolute module paths as strings
 * @example
 * ```ts
 * const paths = resolveModulesPaths('file:///home/user/project/', './module1.js', '../module2.js');
 * console.log(paths);
 * // Output: [
 * //   '/home/user/project/module1.js',
 * //   '/home/user/module2.js'
 * // ]
 * ```
 */
export function resolveModulesPaths(
  baseUrl: URL | string,
  ...refs: (URL | string)[]
): string[] {
  return refs.map((ref) => new URL(ref, baseUrl).pathname);
}
