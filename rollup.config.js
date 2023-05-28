export default {
  input: 'src/js/dataview.js',
  output: {
		file: 'src/cc/addon.js.txt',
		format: 'esm',
    banner: 'R"=====(',
    footer: ')====="',
	}
};