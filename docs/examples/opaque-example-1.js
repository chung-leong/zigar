import { showContext, startContext } from './opaque-example-1.zig';

const ctx = startContext();
console.log(ctx.valueOf());
showContext(ctx);
