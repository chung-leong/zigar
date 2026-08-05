import nodeResolve from '@rollup/plugin-node-resolve';
import zigar from 'rollup-plugin-zigar';

export default [
  {
    input: './zig/scale.zig',
    plugins: [
      zigar({
        optimize: 'ReleaseSmall',
        topLevelAwait: false,
        embedWASM: true,
      }),
      nodeResolve(),
    ],
    output: {
      file: './src/scale.js',
      format: 'umd',
      exports: 'named',
      name: 'Scale',
    },
  },
  {
    input: './zig/sepia.zig',
    plugins: [
      zigar({
        optimize: 'ReleaseSmall',
        topLevelAwait: false,
        embedWASM: true,
      }),
      nodeResolve(),
    ],
    output: {
      file: './src/sepia.js',
      format: 'umd',
      exports: 'named',
      name: 'Sepia',
    },
  },
];

Then run the conversion again:

```sh
npm run build
```

