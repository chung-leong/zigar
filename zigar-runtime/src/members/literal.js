import { mixin } from '../environment.js';
import { SLOTS } from '../symbols.js';
import { bindSlot } from './all.js';

export default mixin({
  defineMemberLiteral(member) {
    const { slot } = member;
    return bindSlot(slot, { get: getLiteral });
  },
});

function getLiteral(slot) {
  const object = this[SLOTS][slot];
  return object.string;
}
