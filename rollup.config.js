export default {
  input: 'src/define.js',
  output: {
		file: 'src/addon.js.txt',
		format: 'iife',
    banner: 'R"=====(',
    footer: ')====="',
	},
  onwarn(warning, warn) {
    if (warning.code === 'EVAL') return
    warn(warning)
  }  
};