import { expect } from 'chai';
import { createHash } from 'crypto';

export function addTests(importModule, options) {
  const importTest = async (name) => {
    const url = new URL(`./${name}.zig`, import.meta.url).href;
    return importModule(url);
  };
  describe('Built-in functions', function() {
    this.timeout(0);
    it('should produce MD5 hash matching that from Node native function', async function() {
      const { md5 } = await importTest('generate-md5-hash');
      const data = new Uint8Array(1024 * 1024);
      for (let i = 0; i < data.byteLength; i++) {
        data[i] = i & 0xFF;
      }
      const digest1 = md5(data);
      const hash = createHash('md5');
      hash.update(data);
      const digest2 = hash.digest();
      for (const [ index, value ] of digest1.entries()) {
        const other = digest2[index];
        expect(value).to.equal(other);
      }
    })
    it('should produce SHA1 hash matching that from Node native function', async function() {
      const { sha1 } = await importTest('generate-sha1-hash');
      const data = new Uint8Array(1024 * 1024);
      for (let i = 0; i < data.byteLength; i++) {
        data[i] = i & 0xFF;
      }
      const digest1 = sha1(data);
      const hash = createHash('sha1');
      hash.update(data);
      const digest2 = hash.digest();
      for (const [ index, value ] of digest1.entries()) {
        const other = digest2[index];
        expect(value).to.equal(other);
      }
    })
  })
}
