import fs from "node:fs/promises";
import { env } from "node:process";
import { expect } from "../deps.js";

/**
 * Compares `actual` with the golden file at `controlFileName`. The control file is only
 * (re)written when the `UPDATE_SNAPSHOTS` environment variable is set, so a regression
 * keeps failing until someone regenerates the file deliberately:
 * `UPDATE_SNAPSHOTS=1 pnpm test`.
 */
export async function expectControlFile(controlFileName: string, actual: string) {
  if (env.UPDATE_SNAPSHOTS) {
    await fs.writeFile(controlFileName, actual, "utf-8");
    return;
  }
  let control: string;
  try {
    control = await fs.readFile(controlFileName, "utf-8");
  } catch (_error) {
    throw new Error(
      `Missing control file ${controlFileName}; run with UPDATE_SNAPSHOTS=1 to create it.`,
    );
  }
  expect(actual).toEqual(control);
}
