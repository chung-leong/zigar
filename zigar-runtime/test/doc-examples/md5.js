// md5.js
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { md5 } from './md5.zig?optimize=ReleaseFast';

const data = readFileSync(process.argv[0]);

console.time('Zig');
const digest1 = md5(data).string;
console.timeEnd('Zig');
console.log(digest1);

console.time('Node');
const hash = createHash('md5');
hash.update(data);
const digest2 = hash.digest('hex');
console.timeEnd('Node');
console.log(digest2);

// console output:
// Zig: 172.672ms
// 46cd8ba8e03525fac17db13dad4362db
// Node: 130.177ms
// 46cd8ba8e03525fac17db13dad4362db
