import { expect } from 'chai';
import { capture } from '../test-utils.js';

export function addTests(importModule, options) {
  const importTest = async (name, options) => {
    const url = new URL(`./${name}.zig`, import.meta.url).href;
    return importModule(url, options);
  };
  describe('Bug fixes', function() {
    this.timeout(0);
    it('should fix issue 689', async function() {
      const { hello } = await importTest('issue-689');
      const [ line ] = await capture(() => {
        hello({
          linear: {
            stops: [ 1, 2, 3 ],
          }
        });
      })
      expect(line).to.contain('.stops = { 1, 2, 3 }')
    })
    it('should fix issue 697', async function() {
      const { Callback, runCallback, setCallback } = await importTest('issue-697', { topLevelAwait: false });
      function hello(number, text) {
        console.log(`number = ${number}, text = ${text.string}`);
      }
      const callback = new Callback(hello);
      await setCallback(callback);
      const [ line ] = await capture(() => runCallback());
      setCallback(null);
      expect(line).to.equal('number = 123, text = Hello world');
    })
    it('should fix issue 723', async function() {
      const { runCallback, setCallback } = await importTest('issue-723');
      const array = [];
      function hello(s) {
        array.push(s.text.string);
      }
      await setCallback(hello);
      for (let i = 0; i < 10; i++) {
        runCallback(`line ${i + 1}`);
      }
      expect(array).to.eql([
        'line 1',
        'line 2',
        'line 3',
        'line 4',
        'line 5',
        'line 6',
        'line 7',
        'line 8',
        'line 9',
        'line 10',
      ]);
    })
    it('should fix issue 726', async function() {
      const { __zigar: __zigarA, print: printA } = await importTest('issue-726a', { preserve: true });
      const { __zigar: __zigarB, print: printB } = await importTest('issue-726b', { preserve: true });
      const { __zigar: __zigarC, print: printC } = await importTest('issue-726c', { preserve: true });
      try {
        expect(__zigarA).to.not.equal(__zigarB);
        expect(__zigarB).to.not.equal(__zigarC);
        const mapA = new Map([
          [ 'agnieszka.txt', { type: 'file' } ],
          [ 'agata.txt', { type: 'file' } ],
          [ 'alicja.txt', { type: 'file' } ],
        ]);
        const mapB = new Map([
          [ 'basia.txt', { type: 'file' } ],
          [ 'beata.txt', { type: 'file' } ],
        ]);
        const mapC = new Map([
          [ 'cecylia.txt', { type: 'file' } ],
          [ 'celina.txt', { type: 'file' } ],
          [ 'czesia.txt', { type: 'file' } ],
        ]);
        let pathA;
        __zigarA.on('open', (evt) => {
          pathA = evt.path;
          return mapA;
        });
        let pathB;
        __zigarB.on('open', (evt) => {
          pathB = evt.path;
          return mapB;
        });
        let pathC;
        __zigarC.on('open', (evt) => {
          pathC = evt.path;
          return mapC;
        });
        const linesA = await capture(() => printA('/hello/A'));
        const linesB = await capture(() => printB('/hello/B'));
        const linesC = await capture(() => printC('/hello/C'));
        expect(linesA).to.eql([ 'agnieszka.txt', 'agata.txt', 'alicja.txt' ]);
        expect(linesB).to.eql([ 'basia.txt', 'beata.txt' ]);
        expect(linesC).to.eql([ 'cecylia.txt', 'celina.txt', 'czesia.txt' ]);
        expect(pathA).to.equal('hello/A');
        expect(pathB).to.equal('hello/B');
        expect(pathC).to.equal('hello/C');
      } finally {
        __zigarA.abandon();
        __zigarB.abandon();
        __zigarC.abandon();
      }
    })
    it('should fix issue 741', async function() {
      const { __zigar, printInfo, printError } = await importTest('issue-741');
      const log = [];
      __zigar.on('log', (evt) => {
        log.push(evt);
        return true;
      });
      printInfo();
      expect(log).to.have.lengthOf(0);
      printError();
      expect(log).to.have.lengthOf(1);
      expect(log[0]).to.eql({ source: 'stderr', message: 'error: std.log.err\n' });
    })
    it('should fix issue 757', async function() {
      const { default: module } = await importTest('issue-757');
      module.array_of_nothing[0] = undefined;
      expect(() => module.array_of_nothing[0] = undefined).to.not.throw();
      expect(() => module.array_of_nothing[0] = 1).to.throw();
    })
  })
}
