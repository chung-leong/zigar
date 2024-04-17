import { DataSection } from './comptime-field-example-2.zig';

const section = new DataSection({ offset: 16n, len: 256n });
console.log(section.valueOf());