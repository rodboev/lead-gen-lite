const path = require('path');

const trimTime = dateStr => dateStr.substring(0, 10);

module.exports = {
	getDate: () => new Date().toLocaleTimeString()
,	formatDate: dateStr => trimTime(new Date(dateStr).toISOString()),
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
	removeLast: (str, subStr) => str.substring(0, str.lastIndexOf(subStr)),
	truncate: (fullStr, strLen, sep = '...') => {
		if (fullStr.length <= strLen) return fullStr;
		
		const sepLen = sep.length,
			charsToShow = strLen - sepLen,
			frontChars = Math.ceil(charsToShow/2),
			backChars = Math.floor(charsToShow/2);
		
		return fullStr.substr(0, frontChars) + sep + fullStr.substr(fullStr.length - backChars);
	},
	addCommas: num => num.toLocaleString(),
	formatPhoneNumber: str => {
		const cleaned = String(str).replace(/\D/g, '');
		const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
		return match ? `(${match[1]}) ${match[2]}-${match[3]}` : null;
	},
	serializeParams: params => {
        let result = '';
        Object.keys(params).forEach(key => {
            result += `${key}=${encodeURIComponent(params[key])}&`;
        });
        return result.substr(0, result.length - 1);
	},
	removeDuplicates: arr =>{
		return arr.filter((v,i,a)=>a.findIndex(t=>(JSON.stringify(t) === JSON.stringify(v)))===i);
	}
};
