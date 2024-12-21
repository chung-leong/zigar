import NodeResolve from '@rollup/plugin-node-resolve';
import Replace from '@rollup/plugin-replace';
// import Terser from '@rollup/plugin-terser';

export default [
  {
    input: 'src/addon.js',
    plugins: [
      NodeResolve(),
      Replace({
        preventAssignment: true,
        values: {
          'process.env.DEV': 'false',
          'process.env.BITS': '"64"',
          'process.env.TARGET': '"node"',
          'process.env.MIXIN': '""',
        },
      })
    ],
    output: {
      file: 'src/addon.64b.js.txt',
      format: 'iife',
      name: 'variable',
      plugins: [
        // Terser(),
        CPPString(),
      ]
    },
  },
  {
    input: 'src/addon.js',
    plugins: [
      NodeResolve(),
      Replace({
        preventAssignment: true,
        values: {
          'process.env.DEV': 'false',
          'process.env.BITS': '"32"',
          'process.env.TARGET': '"node"',
          'process.env.MIXIN': '""',
        },
      })
    ],
    output: {
      file: 'src/addon.32b.js.txt',
      format: 'iife',
      name: 'variable',
      plugins: [
        // Terser(),
        CPPString(),
      ]
    },
  }
]

function CPPString() {
  // place JS code into a C++ raw string
  return {
    name: 'cpp_string',
    renderChunk (code) {
      const iife = code.replace(/var variable\s*=\s*([\s\S]*);/, '($1)');
      const lines = iife.split(/(?<=\n)/);
      const literals = lines.map(l => JSON.stringify(l));
      return literals.join('\n');
    }
  };
}