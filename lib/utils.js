const path = require('path');

const trimTime = dateStr => dateStr.substring(0, 10);

module.exports = {
	getDate: () => new Date().toLocaleTimeString(),
	formatDate: dateStr => trimTime(new Date(dateStr).toISOString()),
	todayMinus: days => trimTime(new Date(new Date().setDate(new Date().getDate() - days)).toISOString()),
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
	},
	capitalize: str => str.charAt(0).toUpperCase() + str.slice(1),
	removeLast: (str, subStr) => str.substring(0, str.lastIndexOf(subStr))
};
