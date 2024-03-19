import nodeResolve from '@rollup/plugin-node-resolve';
import zigar from 'rollup-plugin-zigar';

const input = './zig/sha1.zig';

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
];
