import { showContext, startContext } from './opaque-example-2.zig';

const ctx = startContext();
// force garbage collection; require --expose-gc
gc();
showContext(ctx);
