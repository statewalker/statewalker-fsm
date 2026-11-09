// @vitest-environment jsdom
import { FsmProcess, FsmProcessSync, type FsmStateConfig } from "@statewalker/fsm";
import { _addStateRenderer } from "../src/_addStateRenderer.js";
import { renderStateDescription } from "../src/renderStateDescription.js";
import { describe, expect, it } from "./deps.js";

// The viewer must follow the synchronous engine (FsmProcessSync) as well as the
// async one. The sync engine rejects promise-returning handlers (reported through
// onStateError), so the viewer's own handlers must be synchronous.

const config: FsmStateConfig = {
  key: "App",
  transitions: [
    ["", "*", "A"],
    ["A", "go", "B"],
  ],
};

function renderer(stack: string[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  const span = document.createElement("span");
  span.textContent = `desc:${stack[stack.length - 1]} `;
  frag.appendChild(span);
  return frag;
}

describe("viewer with FsmProcessSync", () => {
  it("_addStateRenderer renders and cleans up synchronously, without handler errors", () => {
    const p = new FsmProcessSync(config);
    const errors: unknown[] = [];
    p.onStateError((_, e) => errors.push(e));
    const log: string[] = [];
    _addStateRenderer(p, (stack) => {
      log.push(`+${stack.join(">")}`);
      return () => log.push(`-${stack.join(">")}`);
    });
    p.dispatch("");
    p.dispatch("go");
    expect(errors).toEqual([]);
    expect(log).toEqual(["+App", "+App>A", "-App>A", "+App>B"]);
  });

  it("renderStateDescription follows a sync process", () => {
    const p = new FsmProcessSync(config);
    const errors: unknown[] = [];
    p.onStateError((_, e) => errors.push(e));
    const div = renderStateDescription({ process: p, renderer });
    p.dispatch("");
    p.dispatch("go");
    expect(errors).toEqual([]);
    expect(div.textContent).toBe("desc:App desc:B ");
  });
});

describe("_addStateRenderer with async renderers (async engine)", () => {
  it("awaits an async renderer and runs its cleanup on exit", async () => {
    const p = new FsmProcess(config);
    const log: string[] = [];
    _addStateRenderer(p, async (stack) => {
      await Promise.resolve();
      log.push(`+${stack.join(">")}`);
      return () => log.push(`-${stack.join(">")}`);
    });
    await p.dispatch("");
    await p.dispatch("go");
    expect(log).toEqual(["+App", "+App>A", "-App>A", "+App>B"]);
  });

  it("renders the state that is current when attached", async () => {
    const p = new FsmProcess(config);
    await p.dispatch("");
    const log: string[] = [];
    _addStateRenderer(p, (stack) => {
      log.push(stack.join(">"));
    });
    expect(log).toEqual(["App>A"]);
  });
});

describe("renderStateDescription invalidation", () => {
  it("stops following the process once invalidation resolves", async () => {
    const p = new FsmProcessSync(config);
    let invalidate: () => void = () => {};
    const invalidation = new Promise<void>((r) => {
      invalidate = r;
    });
    const div = renderStateDescription({ process: p, renderer, invalidation });
    p.dispatch("");
    invalidate();
    await invalidation;
    p.dispatch("go");
    // B is entered after invalidation: it must not be rendered.
    expect(div.textContent).not.toContain("desc:B");
  });
});
