import NodeResolve from '@rollup/plugin-node-resolve';
import StripCode from 'rollup-plugin-strip-code';

const input = './src/index.js';
const plugins = [
  NodeResolve({}),
  StripCode({
    start_comment: 'OVERRIDDEN',
    end_comment: 'OVERRIDDEN-END'
  }),
  StripCode({
    start_comment: 'DEV-TEST',
    end_comment: 'DEV-TEST-END'
  }),
  StripCode({
    start_comment: 'NODE-ONLY',
    end_comment: 'NODE-ONLY-END'
  }),
  StripCode({
    start_comment: 'RUNTIME-ONLY',
    end_comment: 'RUNTIME-ONLY-END'
  })
];

export default [
  {
    input,
    plugins,
    output: {
      file: './dist/index.js',
      format: 'esm',
    },
  },
  {
    input,
    plugins,
    output: {
      file: './dist/index.cjs',
      format: 'commonjs',
    },
  }
];
