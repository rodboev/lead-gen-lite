const path = require('path');

const api = require('../lib/api');
const utils = require('../lib/utils');
const eventEmitter = require('../lib/events');
const common = require('./common.js');

function cleanData(records) {
	if (!records) return;

	// Trim extra spaces from addresses
	for (let i = 0; i < records.length; i++) {
		records[i].incident_address = utils.trimWhitespace(records[i].incident_address);
	}

	// TODO: Match extra spaces in permits later using like:
	// https://dev.socrata.com/docs/functions/like.html
	// Sometimes there are multiple spaces after "EAST" or "WEST" in permit
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
		eventEmitter.emit('logging', ` ${err.message}\n`);
	}
	eventEmitter.emit('logging', ` Received ${permits.length}.\n`);

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

async function refreshData(queryLimit = 800) {
	const moduleName = path.basename(module.filename, path.extname(module.filename)).replace(/^(city)/, '');
let records = await common.getRecords("/erm2-nwe9.json?$where=descriptor in('PESTS') OR complaint_type = 'Rodent'&$order=created_date DESC", queryLimit, moduleName);
	records = cleanData(records);
	const permits = await getPermits(records, queryLimit);
	const results = processData(records, permits);
	const csvData = await common.convertToCSV(results, moduleName);
	return csvData;
}

module.exports = { refreshData };