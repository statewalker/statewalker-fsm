import { FsmBaseClass } from "../src/core/fsm-base-class.ts";
import { describe, expect, it } from "./deps.ts";

/** Subclass to expose protected methods for testing. */
class TestBaseClass extends FsmBaseClass {
  addHandler<T>(type: string, handler: T, direct = true) {
    return this._addHandler(type, handler, direct);
  }
  removeHandler<T>(type: string, handler: T) {
    return this._removeHandler(type, handler);
  }
}

describe("FsmBaseClass", () => {
  it("adds handlers in direct order (appended)", () => {
    const base = new TestBaseClass();
    base.addHandler("test", () => {}, true);
    base.addHandler("test", () => {}, true);
    base.addHandler("test", () => {}, true);
    expect(base.handlers.test.length).toBe(3);
  });

  it("adds handlers in reverse order (prepended) when direct=false", () => {
    const base = new TestBaseClass();
    base.addHandler("test", () => {}, false);
    base.addHandler("test", () => {}, false);
    base.addHandler("test", () => {}, false);
    expect(base.handlers.test.length).toBe(3);
  });

  it("runs handlers sequentially in registration order", async () => {
    const base = new TestBaseClass();
    const calls: number[] = [];
    base.addHandler(
      "test",
      () => {
        calls.push(1);
      },
      true,
    );
    base.addHandler(
      "test",
      () => {
        calls.push(2);
      },
      true,
    );
    base.addHandler(
      "test",
      () => {
        calls.push(3);
      },
      true,
    );
    await base._runHandler("test");
    expect(calls).toEqual([1, 2, 3]);
  });

  it("runs reverse-order handlers correctly", async () => {
    const base = new TestBaseClass();
    const calls: number[] = [];
    base.addHandler(
      "test",
      () => {
        calls.push(1);
      },
      false,
    );
    base.addHandler(
      "test",
      () => {
        calls.push(2);
      },
      false,
    );
    base.addHandler(
      "test",
      () => {
        calls.push(3);
      },
      false,
    );
    await base._runHandler("test");
    expect(calls).toEqual([3, 2, 1]);
  });

  it("cleanup function removes the handler", async () => {
    const base = new TestBaseClass();
    const calls: number[] = [];
    const remove1 = base.addHandler(
      "test",
      () => {
        calls.push(1);
      },
      true,
    );
    base.addHandler(
      "test",
      () => {
        calls.push(2);
      },
      true,
    );

    remove1();
    await base._runHandler("test");
    expect(calls).toEqual([2]);
  });

  it("removing last handler deletes the handler list", () => {
    const base = new TestBaseClass();
    const remove = base.addHandler("test", () => {}, true);
    expect(base.handlers.test).toBeDefined();
    remove();
    expect(base.handlers.test).toBeUndefined();
  });

  it("removing non-existent handler is a no-op", () => {
    const base = new TestBaseClass();
    base.removeHandler("nonexistent", () => {});
    expect(base.handlers.nonexistent).toBeUndefined();
  });

  it("runs with no registered handlers without error", async () => {
    const base = new TestBaseClass();
    await base._runHandler("nonexistent");
  });

  it("passes arguments to handlers", async () => {
    const base = new TestBaseClass();
    const received: unknown[] = [];
    base.addHandler(
      "test",
      (...args: unknown[]) => {
        received.push(...args);
      },
      true,
    );
    await base._runHandler("test", "a", 42);
    expect(received).toEqual(["a", 42]);
  });

  it("catches handler errors via _handleError", async () => {
    const base = new TestBaseClass();
    const errors: unknown[] = [];
    base._handleError = async (error) => {
      errors.push(error);
    };
    base.addHandler(
      "test",
      () => {
        throw new Error("boom");
      },
      true,
    );
    await base._runHandler("test");
    expect(errors.length).toBe(1);
    expect((errors[0] as Error).message).toBe("boom");
  });

  it("continues running handlers after one throws", async () => {
    const base = new TestBaseClass();
    const calls: number[] = [];
    base._handleError = async () => {};
    base.addHandler(
      "test",
      () => {
        calls.push(1);
        throw new Error("fail");
      },
      true,
    );
    base.addHandler(
      "test",
      () => {
        calls.push(2);
      },
      true,
    );
    await base._runHandler("test");
    expect(calls).toEqual([1, 2]);
  });

  it("runs async handlers", async () => {
    const base = new TestBaseClass();
    const calls: number[] = [];
    base.addHandler(
      "test",
      async () => {
        await Promise.resolve();
        calls.push(1);
      },
      true,
    );
    base.addHandler(
      "test",
      async () => {
        await Promise.resolve();
        calls.push(2);
      },
      true,
    );
    await base._runHandler("test");
    expect(calls).toEqual([1, 2]);
  });

  it("supports multiple handler types on same instance", async () => {
    const base = new TestBaseClass();
    const calls: string[] = [];
    base.addHandler(
      "enter",
      () => {
        calls.push("enter");
      },
      true,
    );
    base.addHandler(
      "exit",
      () => {
        calls.push("exit");
      },
      true,
    );
    await base._runHandler("enter");
    await base._runHandler("exit");
    expect(calls).toEqual(["enter", "exit"]);
  });
});
