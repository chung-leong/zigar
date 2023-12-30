import { expect } from 'chai';

import { 
  decodeText,
  encodeText,
  encodeBase64,
  decodeBase64,
} from '../src/text.js';

describe('Text functions', function() {
  describe('decodeText', function() {
    it('should convert a Uint8Array into a string', function() {
      const text = 'Hello world!';
      const ta = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        ta[i] = text.charCodeAt(i);
      }
      const result = decodeText(ta, 'utf-8');
      expect(result).to.equal(text);
    })
    it('should convert a Uint16Array into a string', function() {
      const text = 'Cześć świecie!';
      const ta = new Uint16Array(text.length);
      for (let i = 0; i < text.length; i++) {
        ta[i] = text.charCodeAt(i);
      }
      const result = decodeText(ta, 'utf-16');
      expect(result).to.equal(text);
    })
    it('should convert an array of Uint16Arrays into a string', function() {
      const text = 'Cześć świecie!';
      const ta1 = new Uint16Array(text.length);
      const ta2 = new Uint16Array(text.length);
      const ta3 = new Uint16Array(text.length);
      for (let i = 0; i < text.length; i++) {
        ta1[i] = text.charCodeAt(i);
        ta2[i] = text.charCodeAt(i);
        ta3[i] = text.charCodeAt(i);
      }
      const result = decodeText([ ta1, ta2, ta3 ], 'utf-16');
      expect(result).to.equal(text.repeat(3));
    })
    it('should convert an array Uint8Array into a string', function() {
      const text = 'Hello world!';
      const ta1 = new Uint16Array(text.length);
      for (let i = 0; i < text.length; i++) {
        ta1[i] = text.charCodeAt(i);
      }
      const result = decodeText([ ta1 ], 'utf-16');
      expect(result).to.equal(text.repeat(1));
    })
  })
  describe('encodeText', function() {
    it('should convert a string to Uint8Array', function() {
      const text = 'Hello world!';
      const ta = encodeText(text, 'utf-8');
      for (const [ index, c ] of ta.entries()) {
        expect(c).to.equal(text.charCodeAt(index));
      }
    })
    it('should convert a string to Uint16Array', function() {
      const text = 'Cześć świecie!';
      const ta = encodeText(text, 'utf-16');
      for (const [ index, c ] of ta.entries()) {
        expect(c).to.equal(text.charCodeAt(index));
      }
    })
  })
  describe('encodeBase64', function() {
    it('should encode data view to base64 string', function() {
      const dv = new DataView(new ArrayBuffer(5));
      for (let i = 0; i < dv.byteLength; i++) {
        dv.setUint8(i, i);
      }
      const s = encodeBase64(dv);
      expect(s).to.equal('AAECAwQ=');
    })
    it('should use browser function to encode data into base64', function() {
      const buffer = global.Buffer;
      global.Buffer = 'removed';
      try {
        const dv = new DataView(new ArrayBuffer(5));
        for (let i = 0; i < dv.byteLength; i++) {
          dv.setUint8(i, i);
        }
        const s = encodeBase64(dv);
        expect(s).to.equal('AAECAwQ='); 
      } finally {
        global.Buffer = buffer;
      }
    })
  })
  describe('decodeBase64', function() {
    it('should decode base64 string', function() {
      const s = 'AAECAwQ=';
      const dv = decodeBase64(s);
      for (let i = 0; i < dv.byteLength; i++) {
        expect(dv.getUint8(i)).to.equal(i);
      }
    })   
    it('should use browser function to decode base64', function() {
      const buffer = global.Buffer;
      global.Buffer = 'removed';
      try {
        const s = 'AAECAwQ=';
        const dv = decodeBase64(s);
        for (let i = 0; i < dv.byteLength; i++) {
          expect(dv.getUint8(i)).to.equal(i);
        }
      } finally {
        global.Buffer = buffer;
      }
    })
  })
})
