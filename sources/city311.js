
const converter = require('json-2-csv');

const api = require('../lib/api');
const utils = require('../lib/utils');
const eventEmitter = require('../lib/events');

// Prep 311 requests array
async function getRecords(queryLimit = 1000) {
	const recordsURL = "/erm2-nwe9.json?$where=descriptor%20in(%27PESTS%27)%20OR%20complaint_type%20=%20%27Rodent%27&$order=created_date%20DESC&$limit=" + queryLimit;

	eventEmitter.emit('logging', `[${utils.getDate()}] (311) Requesting ${queryLimit} 311 records...\n`);
	const recordsReq = await api.get(recordsURL);
	const records = recordsReq.data;

	// Trim extra spaces from addresses
	for (let i = 0; i < records.length; i++) {
		records[i].incident_address = utils.trimWhitespace(records[i].incident_address);
	}

	// TODO: Match extra spaces in permits later using like:
	// https://dev.socrata.com/docs/functions/like.html
	// Sometimes there are multiple spaces after "EAST" or "WEST" in permits

	return records;
}

// Extract addresses and request permits
async function getPermits(records, queryLimit = 1000) {
	let addresses = new Set();
	let numPermits = 0;

	for (let i = 0; i < records.length; i++) {
		addresses.add(records[i].incident_address);
		numPermits++;
	}

	// Split address string into street number and name
	const addressesSep = [];

	for (const address of addresses) {
		let newAddress = {};
		let [beforeSpace, ...afterSpace] = address.split(" ");
		afterSpace = afterSpace.join(" ");
		newAddress.houseNumber = beforeSpace;
		newAddress.streetName = afterSpace;
		addressesSep.push(newAddress);
	}

	let requestString = '';
	const prefix = `(house__ in('`;
	const middle = `') AND street_name in('`;
	const end = `'))`;
	for (let i = 0; i < addressesSep.length; i++) {
		requestString += `${prefix}${addressesSep[i].houseNumber}${middle}${addressesSep[i].streetName}${end}`;
		if (i !== addressesSep.length - 1) {
			requestString += ' OR ';
		}
	}

	// (house__ in('345') AND street_name in('3 STREET')) OR 

	const permitsURL = `/ipu4-2q9a.json?$where=${requestString}&$order=filing_date DESC&$limit=${queryLimit * 10}`;

	eventEmitter.emit('logging', `[${utils.getDate()}] (311) Found ${addresses.size} addresses. Requesting permits...\n`);
	console.log('Requesting: ' + permitsURL)
	const permitsReq = await api.get(permitsURL);
	const permits = permitsReq.data;

	return permits;
}

// Push data into separate categories
function processData(records, permits) {
	eventEmitter.emit('logging', `[${utils.getDate()}] (311) Received ${permits.length} permits for 311 records...\n`);
}

const dataCsv = Object.create(null);

async function refreshData(queryLimit) {
	const records = await getRecords(queryLimit);
	const permits = await getPermits(records, queryLimit);
	const results = processData(records, permits);

	const cacheLength = await api.cache.length();
	eventEmitter.emit('logging', `[${utils.getDate()}] (311) ${cacheLength} external API calls cached. Done.\n`);
}

module.exports = { getRecords, getPermits, processData, refreshData, dataCsv };