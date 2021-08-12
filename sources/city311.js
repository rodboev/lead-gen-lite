
const converter = require('json-2-csv');

const api = require('../lib/api');
const utils = require('../lib/utils');
const eventEmitter = require('../lib/events');

// Prep 311 requests array
async function getRecords(queryLimit = 800) {
	const recordsURL = "/erm2-nwe9.json?$where=descriptor%20in(%27PESTS%27)%20OR%20complaint_type%20=%20%27Rodent%27&$order=created_date%20DESC&$limit=" + queryLimit;

	eventEmitter.emit('logging', `[${utils.getDate()}] (311) Requesting ${queryLimit} 311 records...`);
	let records;
	try {
		const recordsReq = await api.get(recordsURL);
		records = recordsReq.data;
	}
	catch (err) {
		eventEmitter.emit('logging', ` error: ${err.response}\n`);
	}
	eventEmitter.emit('logging', ` received.\n`);

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
async function getPermits(records, queryLimit = 800) {
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

	const permitsURL = `/ipu4-2q9a.json?$where=${requestString}&$order=filing_date DESC&$limit=${queryLimit * 10}`;

	eventEmitter.emit('logging', `[${utils.getDate()}] (311) Found ${addresses.size} addresses. Requesting permits...`);
	// console.log('Requesting: ' + permitsURL);
	let permits = [];
	try {
		const permitsReq = await api.get(permitsURL);
		permits = permitsReq.data;
	}
	catch (err) {
		eventEmitter.emit('logging', ` error: ${err.response}\n`);
	}
	eventEmitter.emit('logging', ` received ${permits.length}.\n`);

	return permits;
}

// Push data into separate categories
function processData(records, permits) {
	const dataObj = {
		withContacts: [],
		withoutContacts: []
	};

	// Split address string into street number and name
	// TODO: Deduplicate this code with addressesSep above
	for (const record of records) {
		let newAddress = {};
		let [beforeSpace, ...afterSpace] = record.incident_address.split(" ");
		afterSpace = afterSpace.join(" ");
		record.houseNumber = beforeSpace;
		record.streetName = afterSpace;
	}

	for (let i = 0; i < records.length; i++) {
		let record = Object.create(null);
		record.date = utils.formatDate(records[i].created_date);
		record.notes = `${records[i].incident_address} ${records[i].borough} ${records[i].incident_zip} HAS ${records[i].complaint_type.toUpperCase()}: ${records[i].descriptor.toUpperCase()}`;

		permit = permits.find(permit => records[i].houseNumber === permit.owner_s_house__ && records[i].streetName === permit.owner_s_house_street_name);
		if (permit && permit.owner_s_phone__) {
			record.company = permit.owner_s_business_name || '';
			if (record.company === 'NA' || record.company === 'N/A')
				record.company = '';
			record.first_name = permit.owner_s_first_name;
			record.last_name = permit.owner_s_last_name;
			record.address = `${permit.owner_s_house__} ${permit.owner_s_house_street_name}`;
			record.city = permit.city;
			record.state = permit.state;
			record.zip = permit.owner_s_zip_code;
			record.phone = permit.owner_s_phone__;
			dataObj.withContacts.push(record);
		}
		else {
			dataObj.withoutContacts.push(record);
		}
	}

	return dataObj;
}

const dataCsv = Object.create(null);

async function refreshData(queryLimit) {
	const records = await getRecords(queryLimit);
	const permits = await getPermits(records, queryLimit);
	const results = processData(records, permits);

	let totalCount = 0;
	for (const dataValue of Object.values(results)) {
		totalCount += dataValue.length;
	}

	for (const [dataType, dataValue] of Object.entries(results)) {
		eventEmitter.emit('logging', `[${utils.getDate()}] (311) Pushing ${Object.keys(dataValue).length} leads (${Math.round(Object.keys(dataValue).length / totalCount * 100)}%) to 311-${utils.hyphenate(dataType)}.csv...\n`);
		dataCsv[dataType] = await converter.json2csvAsync(dataValue);
	}

	const cacheLength = await api.cache.length();
	eventEmitter.emit('logging', `[${utils.getDate()}] (311) ${cacheLength} external API calls cached. Done.\n`);
}

module.exports = { getRecords, getPermits, processData, refreshData, dataCsv };