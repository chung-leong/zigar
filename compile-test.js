import { compile } from './src/js/compile.js';

const { pathname } = new URL('./test-target.zig', import.meta.url);
(async() => {
    const result = await compile(pathname);
    console.log({ result });
})();
