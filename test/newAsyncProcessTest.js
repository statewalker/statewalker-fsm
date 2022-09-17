import expect from 'expect.js';
import { newAsyncProcess } from '../src/index.js';

describe('newAsyncProcess', () => {

  const main = {
    key: 'MAIN',
    transitions: [
      ['', '*', 'LOGIN', { key: 'logIn', message: 'Hello, there' }],
      ['LOGIN', 'ok', 'MAIN_VIEW'],
      ['MAIN_VIEW', '*', 'MAIN_VIEW'],
      ['MAIN_VIEW', 'logout', 'LOGIN'],
    ],
    states: [
      {
        key: 'LOGIN',
        transitions: [
          ['', '*', 'FORM']
        ],
      },
      {
        key: 'MAIN_VIEW',
        transitions: [
          ['*', '*', 'PAGE_VIEW'],
          ['*', 'logout', ''],
          ['PAGE_VIEW', 'edit', 'PAGE_EDIT'],
          ['PAGE_EDIT', 'ok', 'PAGE_UPDATED_MESSAGE'],
        ],
        states: [
          {
            key: 'PAGE_EDIT',
            transitions: [
              ['', '*', 'FORM']
            ],
          }
        ]
      },

      {
        key: 'FORM',
        transitions: [
          ['', '*', 'SHOW_FORM'],
          ['SHOW_FORM', '*', 'VALIDATE_FORM'],
          ['SHOW_FORM', 'cancel', ''],
          ['VALIDATE_FORM', 'ok', ''],
          ['VALIDATE_FORM', '*', 'SHOW_FORM_ERRORS'],
          ['SHOW_FORM_ERRORS', '*', 'SHOW_FORM'],
          ['SHOW_FORM_ERRORS', 'cancel', ''],
        ],
      }
    ],
  }

  const options = {
    config: main,
    events: [
      // Start application
      '',
      // Login session
      'submit', 'error', 'ok', 'submit', 'ok',
      // Main state
      'tto',
      // Edit
      'edit', 'submit', 'ok',
      // Close the result message
      'ok',
      // Exit from the main view
      'logout'
    ],
    control: [
      '-[]->MAIN/LOGIN/FORM/SHOW_FORM',
      '-[submit]->MAIN/LOGIN/FORM/VALIDATE_FORM',
      '-[error]->MAIN/LOGIN/FORM/SHOW_FORM_ERRORS',
      '-[ok]->MAIN/LOGIN/FORM/SHOW_FORM',
      '-[submit]->MAIN/LOGIN/FORM/VALIDATE_FORM',
      '-[ok]->MAIN/MAIN_VIEW/PAGE_VIEW',
      '-[tto]->MAIN/MAIN_VIEW/PAGE_VIEW',
      '-[edit]->MAIN/MAIN_VIEW/PAGE_EDIT/FORM/SHOW_FORM',
      '-[submit]->MAIN/MAIN_VIEW/PAGE_EDIT/FORM/VALIDATE_FORM',
      '-[ok]->MAIN/MAIN_VIEW/PAGE_UPDATED_MESSAGE',
      '-[ok]->MAIN/MAIN_VIEW/PAGE_VIEW',
      '-[logout]->MAIN/LOGIN/FORM/SHOW_FORM',
    ],
    traces: [
      '  <MAIN event="">',
      '    <LOGIN event="">',
      '      <FORM event="">',
      '        <SHOW_FORM event="">',
      '         [SHOW_FORM:]',
      '        </SHOW_FORM>',
      '        <VALIDATE_FORM event="submit">',
      '         [VALIDATE_FORM:submit]',
      '        </VALIDATE_FORM>',
      '        <SHOW_FORM_ERRORS event="error">',
      '         [SHOW_FORM_ERRORS:error]',
      '        </SHOW_FORM_ERRORS>',
      '        <SHOW_FORM event="ok">',
      '         [SHOW_FORM:ok]',
      '        </SHOW_FORM>',
      '        <VALIDATE_FORM event="submit">',
      '         [VALIDATE_FORM:submit]',
      '        </VALIDATE_FORM>',
      '      </FORM>',
      '    </LOGIN>',
      '    <MAIN_VIEW event="ok">',
      '      <PAGE_VIEW event="ok">',
      '       [PAGE_VIEW:ok]',
      '      </PAGE_VIEW>',
      '      <PAGE_VIEW event="tto">',
      '       [PAGE_VIEW:tto]',
      '      </PAGE_VIEW>',
      '      <PAGE_EDIT event="edit">',
      '        <FORM event="edit">',
      '          <SHOW_FORM event="edit">',
      '           [SHOW_FORM:edit]',
      '          </SHOW_FORM>',
      '          <VALIDATE_FORM event="submit">',
      '           [VALIDATE_FORM:submit]',
      '          </VALIDATE_FORM>',
      '        </FORM>',
      '      </PAGE_EDIT>',
      '      <PAGE_UPDATED_MESSAGE event="ok">',
      '       [PAGE_UPDATED_MESSAGE:ok]',
      '      </PAGE_UPDATED_MESSAGE>',
      '      <PAGE_VIEW event="ok">',
      '       [PAGE_VIEW:ok]',
      '      </PAGE_VIEW>',
      '    </MAIN_VIEW>',
      '    <LOGIN event="logout">',
      '      <FORM event="logout">',
      '        <SHOW_FORM event="logout">',
      '         [SHOW_FORM:logout]',
    ]
  }

  function newProcess(traces = []) {
    let process;
    const before = (process) => {
      const state = process.current;
      const eventKey = (process.event || {}).key || '';
      process.print(`<${state.key} event="${eventKey}">`)
    };
    const after = (process) => {
      const state = process.current;
      process.print(`</${state.key}>`);
    }
    process = newAsyncProcess({
      config: options.config,
      before,
      after
    });
    process.print = (msg) => {
      let shift = '';
      for (let i = 0; i <= process.stack.length; i++) {
        shift += '  ';
      }
      traces.push(shift + msg);
    }

    process.getPath = () => {
      const stack = [...process.stack, process.current];
      return stack.map(s => s.key).join('/')
    };
    process.getEventKey = () => (process.event && process.event.key) || '';
    process.getStateKey = () => (process.current && process.current.key) || '';

    return process;
  }

  it(`should iterate over states and perform required state transitions`, async () => {
    const testTraces = [];
    const process = newProcess(testTraces);

    const { events, control, traces } = options;
    const test = [];
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      await process.next({ key: event });

      const stateKey = process.getStateKey();
      const eventKey = process.getEventKey();
      test.push(`-[${eventKey}]->${process.getPath()}`);
      process.print(` [${stateKey}:${eventKey}]`);
    }
    expect(test).to.eql(control);
    expect(testTraces).to.eql(traces);
  })
})
