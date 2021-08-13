const path = require('path');

const api = require('../lib/api');
const utils = require('../lib/utils');
const eventEmitter = require('../lib/events');
const common = require('./common.js');

const moduleName = path.basename(module.filename, path.extname(module.filename)).replace(/^(city)/, '');

function cleanData(records) {
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
	let uniqueAddresses = new Set();

	for (let i = 0; i < records.length; i++) {
		uniqueAddresses.add(records[i].incident_address);
	}

	// Split address string into street number and name
	const addressesSep = [];
	for (const address of uniqueAddresses) {
		let newAddress = {};
		let [beforeSpace, ...afterSpace] = address.split(" ");
		afterSpace = afterSpace.join(" ");
		newAddress.houseNumber = beforeSpace;
		newAddress.streetName = afterSpace;
		addressesSep.push(newAddress);
	}

	// Build request string for Socrata API query
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

	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Requesting permits for ${uniqueAddresses.size} unique addresses...\n`);

	// console.log('Requesting: ' + permitsURL);
	// TODO: Check permitsURL.length and figure out when Socrata throws a 404
	// TODO: Then batch into sets of less than that string length

	const permits = await common.getPermitsByURL(permitsURL, moduleName);

	return permits;
}

// Try to match up every record with an owner
function applyPermits(records, permits) {
	const dataObj = {
		withContacts: [],
		withoutContacts: []
	};

	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Applying ${permits.length} permits to ${records.length} ${moduleName} records...\n`);

	// Add some extra data to each record, splitting original address tring into a house number and street name
	// TODO: Deduplicate this code with addressesSep above
	records.forEach(record => {
		let newAddress = {};
		let [beforeSpace, ...afterSpace] = record.incident_address.split(" ");
		afterSpace = afterSpace.join(" ");
		record.houseNumber = beforeSpace;
		record.streetName = afterSpace;
	});

	records.forEach(record => {
		// Find most recent owner that matches house number and street name
		const permit = permits.find(permit => permit.owner_s_house__ === record.houseNumber && permit.owner_s_house_street_name === record.streetName);

		// Construct a new entry since we need to transform the existing fields
		const newEntry = common.applyPermit(record, permit, {
			date: utils.formatDate(record.created_date),
			notes: `${record.incident_address} ${record.borough} ${record.incident_zip} HAS ${record.complaint_type.toUpperCase()}: ${record.descriptor.toUpperCase()}`
		});
	
		if (newEntry.phone) {
			dataObj.withContacts.push(newEntry);
		}
		else {
			dataObj.withoutContacts.push(newEntry);
		}
	});

	return dataObj;
}

let dataCsv = Object.create(null);

async function refreshData(queryLimit = 800) {
	const recordsURL = "/erm2-nwe9.json?$where=descriptor in('PESTS') OR complaint_type = 'Rodent'&$order=created_date DESC";
	let records = await common.getRecords(recordsURL, queryLimit, moduleName);
	records = cleanData(records);
	const permits = await getPermits(records, queryLimit);
	const results = applyPermits(records, permits);
	data = await common.convertToCSV(results, moduleName);
}

function getData(dataType) {
	return data[dataType];
}

module.exports = { refreshData, getData };