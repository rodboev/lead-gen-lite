module.exports = {
	getDate: () => new Date().toLocaleString('en-US'),
	formatDate: dateStr => new Date(dateStr).toISOString().substring(0,10),
	hyphenate: str => str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`),
	unhyphenate: str => str.replace(/-./g, letter => letter.substring(1).toUpperCase()),
	removeExt: str => str.split('.')[0],
	trimWhitespace: str => str.replace(/\s\s+/g, ' ')
};
