import ComptimeFloatTests from './comptime-float/tests.js';
import ComptimeIntTests from './comptime-int/tests.js';
import EnumTests from './enum/tests.js';
import EnumLiteralTests from './enum-literal/tests.js';
import ErrorSetTests from './error-set/tests.js';
import ErrorUnionTests from './error-union/tests.js';
import FloatTests from './float/tests.js';
import FnTestTests from './fn/tests.js';
import IntTests from './int/tests.js';
import NoReturnTests from './no-return/tests.js';
import NullTests from './null/tests.js';
import OptionalTests from './optional/tests.js';
import TypeTests from './type/tests.js';
import UndefinedTests from './undefined/tests.js';
import VectorTests from './vector/tests.js';
import VoidTests from './void/tests.js';

import IntTests from './int/tests.js';

export function addTests(importModule, options) {
  describe('Type handling', function() {
    ComptimeFloatTests.addTests(importModule, options);
    ComptimeIntTests.addTests(importModule, options);
    EnumTests.addTests(importModule, options);
    EnumLiteralTests.addTests(importModule, options);
    ErrorSetTests.addTests(importModule, options);
    ErrorUnionTests.addTests(importModule, options);
    FloatTests.addTests(importModule, options);
    FnTestTests.addTests(importModule, options);
    IntTests.addTests(importModule, options);
    NoReturnTests.addTests(importModule, options);
    NullTests.addTests(importModule, options);
    OptionalTests.addTests(importModule, options);
    TypeTests.addTests(importModule, options);
    UndefinedTests.addTests(importModule, options);
    VectorTests.addTests(importModule, options);
    VoidTests.addTests(importModule, options);
  })
}
