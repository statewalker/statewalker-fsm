import { describe, it, expect } from "./deps.ts";
import { Observer, listenAll, iterator } from "@agen/utils";

export type Dependencies = Record<string, any> | (() => Record<string, any>);

export type AsyncIterable<T> = AsyncGenerator<T> | (() => AsyncGenerator<T>);
export type SyncIterable<T> = Generator<T> | (() => Generator<T>);
export type Iterable<T> = SyncIterable<T> | AsyncIterable<T>;

function resolveDependencies<T = any>(
  deps: Record<string, Iterable<T>>
): () => AsyncGenerator<Record<string, T>> {
  return iterator((o: Observer) => listenAll(deps, o));
}

describe("resolveDependencies", () => {
  function toAsync<T = any>(values: T[], timeout = 5): () => AsyncGenerator<T> {
    return async function* () {
      for await (const value of values) {
        yield value;
        await new Promise((resolve) => setTimeout(resolve, timeout));
      }
    };
  }
  it("should resolve empty dependencies", async () => {
    const deps = {
      a: toAsync(["a1", "a2", "a3"]),
      b: toAsync(["b1", "b2", "b3"]),
      c: toAsync(["c1", "c2", "c3"]),
    };
    const values = resolveDependencies(deps);
    const results: Record<string, string>[][] = [];
    const resolve: ((r: void) => void)[] = [];
    const promises: Promise<void>[] = [];
    const N = 10;
    for (let i = 0; i < N; i++) {
      promises.push(new Promise<void>((r) => resolve.push(r)));
      (async (idx: number) => {
        const list: Record<string, string>[] = [];
        results.push(list);
        for await (const value of values()) {
          list.push(value);
          await new Promise((r) => setTimeout(r, 10));
        }
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

    // Await all paralllel executions
    await Promise.all(promises);

    // console.log("?", results);
    expect(results).toEqual(control);
  });
});
