const converter = require('json-2-csv');

const api = require('../lib/api');
const utils = require('../lib/utils');
const eventEmitter = require('../lib/events');

const defaultLimit = 50000;
const defaultDays = 5;
const permitsAPI = '/ipu4-2q9a.json';

// Prep records array
async function getRecords({ moduleName = '', baseURL = '', where = '', days, dateField, orderBy }) {
	// Log request
	// TODO: Use decorators for this
	let loggingString = `[${utils.getDate()}] (${moduleName}) Requesting `;
	days && (loggingString += `${days} days of `);
	loggingString += `${moduleName} records...\n`;
	eventEmitter.emit('logging', loggingString);

	// Pass on the request
	const records = await fetchData({ moduleName, baseURL, where, days, dateField, orderBy, requestType: 'records' });

	return records;
}

async function convertToCSV(results, moduleName = '') {
	if (!results) eventEmitter.emit('logging', `[ERROR] Nothing to convert to CSV.\n`);

	let totalCount = 0;
	for (const dataValue of Object.values(results)) {
		totalCount += dataValue.length;
	}

	const dataCsv = Object.create(null);
	for (const [dataType, dataValue] of Object.entries(results)) {
		let filename = `${moduleName.toLowerCase()}-${utils.hyphenate(dataType)}.csv`;
		let numLeads = Object.keys(dataValue).length;
		let pctOfTotal = Math.round(Object.keys(dataValue).length / totalCount * 100);

		eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Pushing ${utils.addCommas(numLeads)} leads (${pctOfTotal}%) to ${filename}...\n`);

		dataCsv[dataType] = await converter.json2csvAsync(dataValue, {
			emptyFieldValue: ''
		});
	}

	return dataCsv;
}

function getUniquePermits(permits, moduleName = '') {
	if (!permits) eventEmitter.emit('logging', `[ERROR] No records to process.\n`);

	let uniquePermits = [];
	const matchBy = ['bin__', 'house__', 'street_name', 'block', 'lot'];
	permits.forEach(permit => {
		if (!uniquePermits.some(uniquePermit => uniquePermit.bin__ === permit.bin__ && uniquePermit.owner_s_house__ === permit.owner_s_house__ && uniquePermit.owner_s_house_street_name === permit.owner_s_house_street_name)) {
			// TODO: Parse date and push only if date is newest
			uniquePermits.push(permit);
		}
	});

	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Filtering ${utils.addCommas(permits.length)} permits down to ${uniquePermits.length} uniques...\n`);

	return Array.from(uniquePermits);
}

async function fetchData({ moduleName = '', baseURL, where = '', days, dateField, orderBy, requestType = 'request' }) {
	// Add number of days to where (whereString)
	if (where || days) {
		const dateString = days ? `${dateField}>='${utils.todayMinus(days)}'` : '';
		where = [where, dateString].filter(Boolean).join(' AND ');
	}

	// Construct request
	const queryParams = {
		$where: where,
		$order: `${orderBy} DESC`,
		$limit: defaultLimit
	};
	const queryString = api.getUri({url: baseURL, params: queryParams });
	console.log(utils.truncate(`> Requesting ${moduleName} ${requestType}: ${queryString}`, 256));

	// Get data
	let records;
	try {
		const recordsReq = await api.get(queryString);
		records = recordsReq.data;
		// eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Got ${utils.addCommas(records.length)} ${requestType} from ${moduleName}.\n`);
	}
	catch (err) {
		eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) ${requestType.toUpperCase()} ERROR: ${err.message}\n`);
	}

	return records;
}

function applyPermit(record, permit, customFields) {
	const newEntry = Object.create(null);
	newEntry.date = customFields.date;
	newEntry.notes = customFields.notes.toUpperCase();

	if (permit) {
		newEntry.company = permit.owner_s_business_name;
		if (newEntry.company === 'NA' || newEntry.company === 'N/A') {
			newEntry.company = '';
		}
		newEntry.first_name = permit.owner_s_first_name;
		newEntry.last_name = permit.owner_s_last_name;
		newEntry.address = `${permit.owner_s_house__} ${permit.owner_s_house_street_name}`;
		newEntry.city = permit.city;
		newEntry.state = permit.state;
		newEntry.zip = permit.owner_s_zip_code;
		if (permit.owner_s_phone__) {
			newEntry.phone = permit.owner_s_phone__;
		}
	}

	return newEntry;
}

module.exports = {
	defaultLimit,
	defaultDays,
	permitsAPI,
	getRecords,
	convertToCSV,
	fetchData,
	getUniquePermits,
	applyPermit
};