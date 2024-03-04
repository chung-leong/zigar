import { expect } from 'chai';
import { readFile } from 'fs/promises';
import 'mocha-skip-if';
import { fileURLToPath } from 'url';
import { capture } from '../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
    const url = new URL(`./${name}.zig`, import.meta.url).href;
    return importModule(url);
  };
  const loadData = async (name) => {
    const url = new URL(`./data/${name}.txt`, import.meta.url).href;
    const path = fileURLToPath(url);
    const text = await readFile(path, 'utf-8');
    return text.trim().split(/\r?\n/);
  };
  skip.if(!process.env.npm_lifecycle_event?.includes(':extended')).  
  describe('Zig Benchmarks Game', function() {
    it('should produce the right results for the binary-trees example', async function() {
      this.timeout(120000);
      const { binaryTree } = await importTest('binary-trees');
      const n = 12;
      const lines = await capture(() => binaryTree(n));
      const refLines = await loadData(`binary-trees-${n}`);
      expect(lines.length).to.not.equal(0);
      for (const [ index, line ] of lines.entries()) {
        expect(line).to.equal(refLines[index]);
      }
    })
    it('should produce the right results for the fannkuch-redux example', async function() {
      this.timeout(120000);
      const { Pfannkuchen } = await importTest('fannkuch-redux');
      const n = 10;
      const result = Pfannkuchen(n);
      expect(result.checksum).to.equal(73196);
      expect(result.max_flips_count).equal(38);
    })
    it('should produce the right results for the fasta example', async function() {
      this.timeout(120000);
      const { fasta } = await importTest('fasta');
      const n = 250000;
      const lines = await capture(() => fasta(n));
      const refLines = await loadData(`fasta-${n}`);
      expect(lines.length).to.not.equal(0);
      for (const [ index, line ] of lines.entries()) {
        expect(line).to.equal(refLines[index]);
      }
    })
    it('should produce the right results for the k-nucleotide example', async function() {
      this.timeout(120000);
      const { kNucleotide } = await importTest('k-nucleotide');
      const n = 250000;
      const lines = await loadData(`fasta-${n}`); 
      const start = lines.findIndex(l => l.startsWith('>THREE'));
      if (start === -1) {
        throw new Error('Unable to find starting position');
      }
      const input = lines.slice(start + 1);
      const output = kNucleotide(input);
      const outputLines = [ ...output ].map(a => a.string.split(/\n/)).flat();
      const refLines = await loadData(`k-nucleotide-${n}`);
      expect(outputLines).to.eql(refLines);
    })
    it('should produce the right results for the mandelbrot example', async function() {
      this.timeout(120000);
      const { mandelbrot } = await importTest('mandelbrot');
      const n = 2000;
      const lines = await capture(() => mandelbrot(n));
      const refLines = await loadData(`mandelbrot-${n}`);
      expect(lines.length).to.not.equal(0);
      for (const [ index, line ] of lines.entries()) {
        expect(line).to.equal(refLines[index]);
      }
    })
    it('should produce the right results for the nbody example', async function() {
      this.timeout(120000);
      const {
        Planets, solar_mass, year, advance, energy, offset_momentum
      } = await importTest('nbody');
      const solar_bodies = new Planets([
        // Sun
        {
          x: 0.0,
          y: 0.0,
          z: 0.0,
          vx: 0.0,
          vy: 0.0,
          vz: 0.0,
          mass: solar_mass,
        },
        // Jupiter
        {
            x: 4.84143144246472090e+00,
            y: -1.16032004402742839e+00,
            z: -1.03622044471123109e-01,
            vx: 1.66007664274403694e-03 * year,
            vy: 7.69901118419740425e-03 * year,
            vz: -6.90460016972063023e-05 * year,
            mass: 9.54791938424326609e-04 * solar_mass,
        },
        // Saturn
        {
            x: 8.34336671824457987e+00,
            y: 4.12479856412430479e+00,
            z: -4.03523417114321381e-01,
            vx: -2.76742510726862411e-03 * year,
            vy: 4.99852801234917238e-03 * year,
            vz: 2.30417297573763929e-05 * year,
            mass: 2.85885980666130812e-04 * solar_mass,
        },
        // Uranus
        {
            x: 1.28943695621391310e+01,
            y: -1.51111514016986312e+01,
            z: -2.23307578892655734e-01,
            vx: 2.96460137564761618e-03 * year,
            vy: 2.37847173959480950e-03 * year,
            vz: -2.96589568540237556e-05 * year,
            mass: 4.36624404335156298e-05 * solar_mass,
        },
        // Neptune
        {
            x: 1.53796971148509165e+01,
            y: -2.59193146099879641e+01,
            z: 1.79258772950371181e-01,
            vx: 2.68067772490389322e-03 * year,
            vy: 1.62824170038242295e-03 * year,
            vz: -9.51592254519715870e-05 * year,
            mass: 5.15138902046611451e-05 * solar_mass,
        },
      ]);
      const n = 50000;
      offset_momentum(solar_bodies);
      const result1 = energy(solar_bodies['*']);
      advance(solar_bodies, 0.01, n);
      const result2 = energy(solar_bodies['*']);
      expect(year.toFixed(2)).to.equal('365.24');
      expect(solar_mass).to.equal(4.0 * Math.PI * Math.PI);
      expect(result1.toFixed(9)).to.equal('-0.169075164');
      expect(result2.toFixed(9)).to.equal('-0.169078071');
    })
    it('should produce the right results for the reverse-complement example', async function() {
      this.timeout(120000);
      const { reverseComplement } = await importTest('reverse-complement');
      const n = 250000;
      const data = await loadData(`fasta-${n}`);
      reverseComplement(data);
      const refData = await loadData(`reverse-complement-${n}`);
      let different = false;
      for (let i = 0; i < refData.byteLength; i++) {
        if (data[i] !== refData[i]) {
          different = true;
          break;
        }
      }
      expect(refData.byteLength).to.be.above(1000);
      expect(different).to.be.false;
    })
    it('should produce the right results for the spectral-norm example', async function() {
      this.timeout(120000);
      const { spectralNorm } = await importTest('spectral-norm');
      const n = 1500;
      const result = spectralNorm(n);
      expect(result.toFixed(9)).to.equal('1.274224151');
    })
  })
}

