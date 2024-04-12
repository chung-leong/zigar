import { showContext, startContext } from './opaque-example-2.zig';

const ctx = startContext();
gc(); // force immediate garbage collection; requires --expose-gc
showContext(ctx);
