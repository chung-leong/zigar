import nodeResolve from '@rollup/plugin-node-resolve';
import zigar from 'rollup-plugin-zigar';

const input = './zig/hello.zig';

export default [
  {
    input,
    plugins: [
      zigar({ 
        optimize: 'ReleaseSmall', 
        embedWASM: true,
      }),
      nodeResolve(),
    ],
    output: {
      file: './dist/index.js',
      format: 'esm',
    },
  },
  {
    input,
    plugins: [
      zigar({ 
        optimize: 'ReleaseSmall', 
        embedWASM: true, 
        topLevelAwait: false,
      }),
      nodeResolve(),
    ],
    output: {
      file: './dist/index.cjs',
      format: 'cjs',
      exports: 'named',
    },
  },
  {
    input,
    plugins: [
      zigar({ 
        optimize: 'ReleaseSmall', 
        embedWASM: true, 
        topLevelAwait: false,
      }),
      nodeResolve(),
    ],
    output: {
      file: './dist/index.umd.cjs',
      format: 'umd',
      exports: 'named',
      name: 'Hello',
    },
  },
];
