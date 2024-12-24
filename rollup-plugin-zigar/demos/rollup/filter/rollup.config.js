import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import zigar from 'rollup-plugin-zigar';

export default [
  {
    input: './src/sepia.js',
    plugins: [
      zigar({
        optimize: 'ReleaseSmall',
        embedWASM: true,
        topLevelAwait: false,
        multithreaded: true,
      }),
      nodeResolve(),
    ],
    output: {
      file: './dist/sepia.js',
      format: 'umd',
      exports: 'named',
      name: 'Sepia',
      plugins: [
        terser(),
      ]
    },
  },
];
