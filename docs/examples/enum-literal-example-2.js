import { DataSection } from './enum-literal-example-2.zig';

const section = new DataSection({ offset: 16, len: 256 });
console.log(section.valueOf());
