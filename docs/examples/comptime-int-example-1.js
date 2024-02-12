import { base, offset } from './comptime-int-example-1.zig';

try {
    const address = base + offset;
} catch (err) {
    console.log(err.message);
}
