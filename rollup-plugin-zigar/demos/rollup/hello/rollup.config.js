import nodeResolve from '@rollup/plugin-node-resolve';
import zigar from 'rollup-plugin-zigar';

const input = './src/index.js';

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
      name: 'Hello',
    },
  },
];
