// Regression test for statewalker/statewalker-fsm#36: restore must refuse a dump
// taken from a machine with a different root key.
import { FsmProcess, FsmProcessSync, type FsmStateConfig } from "../src/index.ts";
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
