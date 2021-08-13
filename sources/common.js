const converter = require('json-2-csv');

const api = require('../lib/api');
const utils = require('../lib/utils');
const eventEmitter = require('../lib/events');

// Prep records array
async function getRecords({
		moduleName = '',
		baseURL = '',
		customFilter = '',
		days = 7,
		queryLimit,
		dateField,
		orderBy
	}) {
	// TODO: Refactor this with axios.getUri()
	let queryURL = baseURL + '?';
	if (customFilter || days) {
		const dateString = days ? `${dateField}>='${utils.todayMinus(days)}'` : '';
		const whereString = [customFilter, dateString].filter(Boolean).join(' AND ');
		queryURL += `&$where=${whereString}`;
	}
	if (orderBy) {
		queryURL += `&$order=${orderBy} DESC`;
	}
	if (queryLimit) {
		queryURL += `&$limit=${queryLimit}`;
	}

	let loggingString = `[${utils.getDate()}] (${moduleName}) Requesting `;
	if (days) {
		loggingString += `${days} days of `;
	}
	loggingString += `${moduleName} records`;
	if (queryLimit) {
		loggingString += ` (limit ${queryLimit})`;
	}
	loggingString += '...\n';
	eventEmitter.emit('logging', loggingString);

	let records;
	try {
		console.log(`Requesting ${moduleName} records: ${queryURL}`);
		const recordsReq = await api.get(`${queryURL}`);
		records = recordsReq.data;
	}
	catch (err) {
		eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) RECORDS ERROR: ${err.message}\n`);
	}
	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Got ${records.length} records.\n`);
	// console.log(records);

	return records;
}

async function convertToCSV(results, moduleName = '') {
	if (!results) eventEmitter.emit('logging', `[ERROR] Nothing to convert to CSV.`);

	let totalCount = 0;
	for (const dataValue of Object.values(results)) {
		totalCount += dataValue.length;
	}

	const dataCsv = Object.create(null);
	for (const [dataType, dataValue] of Object.entries(results)) {
		let filename = `${moduleName.toLowerCase()}-${utils.hyphenate(dataType)}.csv`;
		let numLeads = Object.keys(dataValue).length;
		let pctOfTotal = Math.round(Object.keys(dataValue).length / totalCount * 100);

		eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Pushing ${numLeads} leads (${pctOfTotal}%) to ${filename}...\n`);

		dataCsv[dataType] = await converter.json2csvAsync(dataValue, {
			emptyFieldValue: ''
		});
	}

	return dataCsv;
}

function getUniquePermits(permits, moduleName = '') {
	if (!permits) eventEmitter.emit('logging', `[ERROR] No records to process.`);

	let uniquePermits = [];
	const matchBy = ['bin__', 'house__', 'street_name', 'block', 'lot'];
	permits.forEach(permit => {
		if (!uniquePermits.some(uniquePermit => uniquePermit.bin__ === permit.bin__ && uniquePermit.owner_s_house__ === permit.owner_s_house__ && uniquePermit.owner_s_house_street_name === permit.owner_s_house_street_name)) {
			// TODO: Parse date and push only if date is newest
			uniquePermits.push(permit);
		}
	});

	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Filtering ${permits.length} permits down to ${uniquePermits.length} uniques...\n`);

	return Array.from(uniquePermits);
}

async function getPermitsByURL(queryURL, moduleName = '') {
	let permits = [];

	try {
		const permitsReq = await api.get(queryURL);
		// console.log(`Requesting ${moduleName} permits: ${queryURL}`);
		permits = permitsReq.data;
	}
	catch (err) {
		eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) PERMITS ERROR:  ${err.message}\n`);
	}

	const uniquePermits = getUniquePermits(permits, moduleName);

	return uniquePermits;
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

const defaultLimit = 1000;

module.exports = { getRecords, convertToCSV, getPermitsByURL, applyPermit, defaultLimit };