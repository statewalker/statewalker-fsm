// Regression test for statewalker/statewalker-fsm#36: restore must refuse a dump
// taken from a machine with a different root key.
import {
  FsmProcess,
  FsmProcessSync,
  type FsmStateConfig,
  KEY_STATES,
  startProcess,
  startProcessSync,
} from "../src/index.ts";
import { describe, expect, it } from "./deps.ts";

const a: FsmStateConfig = { key: "A", transitions: [["", "*", "X"]] };
const b: FsmStateConfig = { key: "B", transitions: [["", "*", "Y"]] };

describe("restore checks the dump's root key (#36)", () => {
  it("async: throws on a dump from another machine and leaves the process untouched", async () => {
    const source = new FsmProcess(b);
    await source.dispatch("");
    const dump = await source.dump();
    const target = new FsmProcess(a);
    await target.dispatch("");
    await expect(target.restore(dump)).rejects.toThrow(/root key "B".*"A"/);
    expect(target.state?.key).toBe("X");
  });

  it("sync: throws on a dump from another machine and leaves the process untouched", () => {
    const source = new FsmProcessSync(b);
    source.dispatch("");
    const target = new FsmProcessSync(a);
    target.dispatch("");
    expect(() => target.restore(source.dump())).toThrow(/root key "B".*"A"/);
    expect(target.state?.key).toBe("X");
  });

  it("still restores a dump from the same machine, and an empty one", async () => {
    const source = new FsmProcess(a);
    await source.dispatch("");
    const target = new FsmProcess(a);
    await target.restore(await source.dump());
    expect(target.state?.key).toBe("X");
    const empty = new FsmProcessSync(a).restore({ status: 0, stack: [] });
    expect(empty.state).toBeUndefined();
  });
});

describe("the runners reject a foreign dump before unwinding the live machine (#36)", () => {
  it("async runner: the machine keeps running after a rejected restore", async () => {
    let cleaned = 0;
    const ctx: Record<string, unknown> = {};
    const h = await startProcess(ctx, a, () => [() => () => void cleaned++]);
    const other = await startProcess({}, b, () => []);
    await expect(h.restore(await other.dump())).rejects.toThrow(/root key "B".*"A"/);
    expect(cleaned).toBe(0);
    expect(ctx[KEY_STATES]).toEqual(["A", "X"]);
  });

  it("sync runner: the machine keeps running after a rejected restore", () => {
    let cleaned = 0;
    const ctx: Record<string, unknown> = {};
    const h = startProcessSync(ctx, a, () => [() => () => void cleaned++]);
    const other = startProcessSync({}, b, () => []);
    expect(() => h.restore(other.dump())).toThrow(/root key "B".*"A"/);
    expect(cleaned).toBe(0);
    expect(ctx[KEY_STATES]).toEqual(["A", "X"]);
  });
});
