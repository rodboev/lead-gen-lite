const converter = require('json-2-csv');

const api = require('../lib/api');
const utils = require('../lib/utils');
const eventEmitter = require('../lib/events');

// Prep records array
async function getRecords(queryURL, queryLimit = 1000, dataSource = '') {
	if (!queryURL) eventEmitter.emit('logging', `[ERROR] Missing URL to query.`);

	eventEmitter.emit('logging', `[${utils.getDate()}] (${dataSource}) Requesting ${queryLimit} ${dataSource} records...\n`);
	let records;
	try {
		const recordsReq = await api.get(`${queryURL}&$limit=${queryLimit}`);
		records = recordsReq.data;
	}
	catch (err) {
		eventEmitter.emit('logging', `[${utils.getDate()}] (${dataSource}) [ERROR] ${err.message}\n`);
	}

	return records;
}

async function convertToCSV(results, dataSource = '') {
	if (!results) eventEmitter.emit('logging', `[ERROR] Nothing to convert to CSV.`);

	let totalCount = 0;
	for (const dataValue of Object.values(results)) {
		totalCount += dataValue.length;
	}

	const dataCsv = Object.create(null);
	for (const [dataType, dataValue] of Object.entries(results)) {
		let filename = `${dataSource.toLowerCase()}-${utils.hyphenate(dataType)}.csv`;
		let numLeads = Object.keys(dataValue).length;
		let pctOfTotal = Math.round(Object.keys(dataValue).length / totalCount * 100);

		eventEmitter.emit('logging', `[${utils.getDate()}] (${dataSource}) Pushing ${numLeads} leads (${pctOfTotal}%) to ${filename}...\n`);

		dataCsv[dataType] = await converter.json2csvAsync(dataValue, {
			emptyFieldValue: ''
		});
	}

	return dataCsv;
}

function getUniquePermits(permits, dataSource = '') {
	if (!permits) eventEmitter.emit('logging', `[ERROR] No records to process.`);

	let uniquePermits = [];
	const matchBy = ['bin__', 'house__', 'street_name', 'block', 'lot'];
	permits.forEach(permit => {
		if (!uniquePermits.some(uniquePermit => uniquePermit.bin__ === permit.bin__ && uniquePermit.owner_s_house__ === permit.owner_s_house__ && uniquePermit.owner_s_house_street_name === permit.owner_s_house_street_name)) {
			// TODO: Parse date and push only if date is newest
			uniquePermits.push(permit);
		}
	});

	eventEmitter.emit('logging', `[${utils.getDate()}] (${dataSource}) Filtering ${permits.length} permits down to ${uniquePermits.length} uniques...\n`);

	return Array.from(uniquePermits);
}

async function getPermitsByURL(permitsURL, dataSource = '') {
	let permits = [];

	try {
		const permitsReq = await api.get(permitsURL);
		permits = permitsReq.data;
	}
	catch (err) {
		eventEmitter.emit('logging', `[${utils.getDate()}] (${dataSource}) [ERROR] ${err.message}\n`);
	}

	const uniquePermits = getUniquePermits(permits, dataSource);

	return uniquePermits;
}

module.exports = { getRecords, convertToCSV, getPermitsByURL };