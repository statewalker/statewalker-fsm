import newAsyncProcess from "./newAsyncProcess.js";

export default function initProcess({ config, handler, handleError = console.error }) {
  const { newAsyncProcess } = FSM;
  let process;
  const before = async (process) => {
    process._started = true;
    const state = process.current;
    handler(state);
    await state.init.run();
  };
  const after = async (process) => {
    const state = process.current;
    await state.done.run();
  };

  process = newAsyncProcess({
    config,
    before,
    after,
    newProcess: (descriptor) => {
      return {
        descriptor,
        config,
        status: 0,
        stack: [],
        event: undefined,
        current: undefined
      };
    },
    newState: (state) => {
      state.init = newStateMethod();
      state.done = newStateMethod();
      state.dispatch = (...args) => state.process.dispatch(...args);
      state.getEvent = () => state.process.event || {};
      state.getEventKey = () => state.getEvent().key;
      return state;
    },
    handleError
  });
  process.dispatch = (key, params = {}) => {
    process.next({ key, params });
  };
  return process;

  function newStateMethod() {
    const list = [];
    return Object.assign((m) => list.push(m), {
      run: async (...args) => {
        // We use the index to iterate over the list: the list can be updated by called methods
        for (let i = 0; i < list.length; i++) {
          try {
            list[i] && (await list[i](...args));
          } catch (error) {
            console.error(error);
            await handleError(error);
          }
        }
      }
    });
  }
}