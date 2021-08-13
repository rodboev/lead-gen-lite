const path = require('path');

module.exports = {
	getDate: () => new Date().toLocaleTimeString(),
	formatDate: dateStr => new Date(dateStr).toISOString().substring(0,10),
	hyphenate: str => str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`),
	unhyphenate: str => str.replace(/-./g, letter => letter.substring(1).toUpperCase()),
	removeExt: str => str.split('.')[0],
	trimWhitespace: str => str.replace(/\s\s+/g, ' '),
	camelCaseArray: arr => {
		let str = '';
		arr.forEach(function (el, idx) {
			var add = el.toLowerCase();
			str += (idx === 0 ? add : add[0].toUpperCase() + add.slice(1));
		});
		return str;
	}
};
