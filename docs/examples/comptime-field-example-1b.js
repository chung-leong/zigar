import { Header } from './comptime-field-example-1.zig';

const header = new Header({ id: 123, flags: 0, offset:0 });
console.log(header.valueOf());
