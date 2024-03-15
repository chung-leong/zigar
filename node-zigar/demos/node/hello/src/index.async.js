const { createRequire } = await import('node-zigar/cjs');
const { hello } = createRequire(import.meta.url)('../lib/hello.zigar');
hello();
