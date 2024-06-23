// import {  } from "../../agen-utils/dist/index";
import { describe, it, expect } from "./deps.ts";
import { Observer, IterableLike, iterator, listenRecords } from "@agen/utils";

export type Dependencies = Record<string, any> | (() => Record<string, any>);

function listenRecordsProviders<T, E = Error, K extends keyof T = keyof T>(
  deps: Record<K, () => AsyncIterable<T[K]>>
): () => AsyncGenerator<T> {
  return iterator<T, E>((o: Observer<T, E>) => listenRecords<T, E, K>(deps, o));
}

describe("listenRecordsProviders", () => {
  function toAsync<T = any>(values: T[], timeout = 5): () => AsyncGenerator<T> {
    return async function* () {
      for await (const value of values) {
        yield value;
        await new Promise((resolve) => setTimeout(resolve, timeout));
      }
    };
  }
  it("should resolve empty records", async () => {
    const deps = {
      a: toAsync<string>(["a1", "a2", "a3"]),
      b: toAsync<string>(["b1", "b2", "b3"]),
      c: toAsync<string>(["c1", "c2", "c3"]),
    };

    const values = listenRecordsProviders<{
      a: string;
      b: string;
      c: string;
    }>(deps);
    const results: Record<string, string>[][] = [];
    const resolve: ((r: void) => void)[] = [];
    const promises: Promise<void>[] = [];
    const N = 10;
    for (let i = 0; i < N; i++) {
      promises.push(new Promise<void>((r) => resolve.push(r)));
      (async (idx: number) => {
        const list: Record<string, string>[] = [];
        for await (const value of values()) {
          list.push(value);
          await new Promise((r) => setTimeout(r, 10));
        }
        results.push(list);
        resolve[idx]();
      })(i);
    }

    const line: Record<string, string>[] = [];
    for await (const value of values()) {
      line.push(value);
    }
    // Control array
    const control: Record<string, string>[][] = Array.from({ length: N }).map(
      () => line
    );

    // Await all parallel executions
    await Promise.all(promises);

    // console.log("?", control, results);
    expect(results).toEqual(control);
  });

  return;
  async function testRecordsProviders<T>(
    deps: Record<keyof T, () => AsyncIterable<T[keyof T]>>,
    control: T[][]
  ) {
    const values = listenRecordsProviders<T>(deps);
    const results: T[][] = [];
    const resolve: ((r: void) => void)[] = [];
    const promises: Promise<void>[] = [];
    const N = 10;
    for (let i = 0; i < N; i++) {
      promises.push(new Promise<void>((r) => resolve.push(r)));
      (async (idx: number) => {
        const res: T[] = [];
        results.push(res);
        for await (const value of values()) {
          res.push(value);
          await new Promise((r) => setTimeout(r, 10));
        }
        resolve[idx]();
      })(i);
    }

    // Await all paralllel executions
    await Promise.all(promises);

    // console.log("?", results);
    expect(results).toEqual(control);
  }

  // it("should resolve multiple records", async () => {
  //   await testRecordsProviders<{
  //     a: string;
  //     b: string;
  //     c: string;
  //   }>(
  //     {
  //       a: toAsync<string>(["a1", "a2", "a3"]),
  //       b: toAsync<string>(["b1", "b2", "b3"]),
  //       c: toAsync<string>(["c1", "c2", "c3"]),
  //     },
  //     {}
  //   );
  // });
});
