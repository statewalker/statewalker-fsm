import expect from 'expect.js';
import { newAsyncProcess } from '../src/index.js';

describe('FsmProcess: async process execution and events dispatching', () => {

  it("should dispatch events; the latest events non-handled should replace previously dispatched events", async () => {
    let timeout = 10;
    let process;
    async function delay(timeout = 10) {
      await new Promise(r => setTimeout(r, timeout));
    }
    const before = async (process) => {
      const state = process.current;
      const eventKey = (process.event || {}).key || '';
      process.print(`<${state.key} event="${eventKey}">`)
      await delay(timeout);
    };
    const after = (process) => {
      const state = process.current;
      process.print(`</${state.key}>`);
    }
    const config = {
      key: 'Main',
      transitions: [
        ['', '*', 'Start'],
        ['Start', 'a', 'A'],
        ['Start', 'b', 'B'],
        ['Start', 'c', 'C'],
      ],
    }
    process = newAsyncProcess({
      config,
      before,
      after
    });
    let traces = [];
    process.print = (msg) => {
      let shift = '';
      for (let i = 0; i <= process.stack.length; i++) {
        shift += '  ';
      }
      traces.push(shift + msg);
    }
    expect(typeof process.running).to.be('undefined');
    process.next({ key: "start" })
    expect(typeof process.running).to.be('object');
    expect(process.running instanceof Promise).to.be(true);

    await process.running;
    expect(typeof process.running).to.be('undefined');

    await delay(10);


    // Multiple sequencial dispatch operations generate just one promise.
    // The FSM takes into account the latest event.

    process.next({ key: "a" })
    const promise = process.running;

    // New dispatch operations should not 
    process.next({ key: "b" })
    expect(process.running).to.be(promise);

    process.next({ key: "c" })
    expect(process.running).to.be(promise);

    await process.running;
    expect(process.running).to.be(undefined);

    expect(traces).to.eql([
      '  <Main event="start">',
      '    <Start event="start">',
      '    </Start>',
      '    <C event="c">',
    ]);
  })


})
