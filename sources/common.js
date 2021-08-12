const converter = require('json-2-csv');

const api = require('../lib/api');
const utils = require('../lib/utils');
const eventEmitter = require('../lib/events');

// Prep records array
async function getRecords(queryURL, queryLimit = 1000, dataSource = '') {
	if (!queryURL) eventEmitter.emit('logging', `[ERROR] Missing URL to query.`);

	eventEmitter.emit('logging', `[${utils.getDate()}] (${dataSource}) Requesting ${dataSource} ${queryLimit} records...`);
	let records;
	try {
		const recordsReq = await api.get(`${queryURL}&$limit=${queryLimit}`);
		records = recordsReq.data;
	}
	catch (err) {
		eventEmitter.emit('logging', ` ${err.message}\n`);
	}
	if (records) {
		eventEmitter.emit('logging', ` Received ${records.length}.\n`);
	}

	return records;
}

async function convertToCSV(results, dataSource = '') {
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

		dataCsv[dataType] = await converter.json2csvAsync(dataValue);
	}
}

module.exports = { getRecords, convertToCSV };