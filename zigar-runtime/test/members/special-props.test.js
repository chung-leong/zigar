
import { defineClass } from "../../src/environment.js";
import Baseline from '../../src/features/baseline.js';

const Env = defineClass('MemberTest', [ Baseline ]);

describe('isTypedArray', function() {
  // it('should return true when given the correct TypedArray', function() {
  //   const ta = new Int32Array(4);
  //   expect(isTypedArray(ta, Int32Array)).to.be.true;
  // })
  // it('should return false when the array type is different', function() {
  //   const ta = new Int32Array(4);
  //   expect(isTypedArray(ta, Uint32Array)).to.be.false;
  // })
  // it('should return false when given no array type', function() {
  //   const ta = new Int32Array(4);
  //   expect(isTypedArray(ta)).to.be.false;
  // })
})
