import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import zigar from 'rollup-plugin-zigar';

export default [
  {
    input: './def.zig',
    plugins: [
      zigar({
        optimize: 'ReleaseSmall',
      }),
      nodeResolve(),
    ],
    output: {
      file: './dist/def.js',
      format: 'umd',
      exports: 'named',
      name: 'Def',
      plugins: [
        terser(),
      ]
    },
  },
];
