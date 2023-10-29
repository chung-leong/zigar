import Terser from '@rollup/plugin-terser';
import Replace from '@rollup/plugin-replace';

const production = false;

export default {
  input: 'src/addon.js',
  plugins: [
    Replace({
      preventAssignment: true,
      'process.env.ZIGAR_TARGET': '"NODE-CPP-EXT"',
      'process.env.ZIGAR_DEV': 'false',
    }),
  ],
  output: {
    file: 'src/addon.js.txt',
    format: 'iife',
    name: 'variable',
    plugins: [
      production && Terser(),
      {
        // place JS code into a C++ string
        name: 'C++ string',
        renderChunk (code) {
          // rollup insisted on using a variable--remove it
          const iife = code.replace(/var variable\s*=\s*([\s\S]*);/, '($1)');
          // MSVC can't handle long raw string--need to break it up
          const lines = iife.split(/(?<=\n)/);
          const literals = lines.map(l => JSON.stringify(l));
          return literals.join('\n');
        }
      },
    ]
  },
};
