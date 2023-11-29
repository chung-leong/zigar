import IntTests from './int/tests.js';

export function addTests(importModule, options) {
  describe('Type handling', function() {
    IntTests.addTests(importModule, options);
  })
}
