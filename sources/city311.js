const path = require('path');

const api = require('../lib/api');
const utils = require('../lib/utils');
const eventEmitter = require('../lib/events');
const common = require('./common.js');

const moduleName = path.basename(module.filename, path.extname(module.filename)).replace(/^(city)/, '');

function cleanData(records) {
	// Trim extra spaces from addresses
	for (const record of records) {
		record.incident_address = utils.trimWhitespace(record.incident_address)
	}

	// TODO: Match extra spaces in permits later using like:
	// https://dev.socrata.com/docs/functions/like.html
	// Sometimes there are multiple spaces after "EAST" or "WEST" in permit
	return records;
}

// Extract addresses and request permits
async function getPermits(records) {
	// Make addresses unique
	let uniqueAddresses = new Set();
	for (const record of records) {
		uniqueAddresses.add(record.incident_address);
	}

	// Split each address string into a street number and name
	let newAddresses = [];
	for (const record of records) {
		const address = record.incident_address;
		const houseNumber = address.substr(0, address.indexOf(' '));
		const streetName = address.substr(address.indexOf(' ') + 1);
		newAddresses.push({houseNumber, streetName});
	}

	// Build request string:
	// e.g., 325 3 STREET becomes (house__ in('345') AND street_name in('3 STREET'))
	let requestString = '';
	const prefix = `(house__ in('`;
	const middle = `') AND street_name in('`;
	const end = `'))`;
	let trippedLimit;
	
	for (const [i, address] of newAddresses.entries()) {
		// TODO: Batch requests over 32k
		if (requestString.length < 32768) {
			requestString += `${prefix}${address.houseNumber}${middle}${address.streetName}${end} OR `;
		}
		else {
			trippedLimit = true;
		}
	}
	requestString = utils.removeLast(requestString, ' OR ');

	const dateString = 'filing_date';

	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Requesting permits for ${utils.addCommas(uniqueAddresses.size)} unique addresses...\n`);
	if (trippedLimit) {
		eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) WARNING: Permits request shortened. This will result in fewer matches.\n`);
	}

	const permits = await common.getPermitsByURL({
		moduleName,
		baseURL: common.permitsAPI,
		customFilter: requestString,
		orderBy: dateString
	});

	return permits;
}

// Try to match up every record with an owner
function applyPermits(records, permits) {
	const dataObj = {
		withContacts: [],
		withoutContacts: []
	};

	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Applying ${utils.addCommas(permits.length)} permits to ${utils.addCommas(records.length)} records...\n`);

	// Add separate house number and street name to each record
	for (const record of records) {
		const address = record.incident_address;
		record.houseNumber = address.substr(0, address.indexOf(' '));
		record.streetName = address.substr(address.indexOf(' ') + 1);
	}

	for (const record of records) {
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
	}

	return dataObj;
}

let data;

async function refreshData({days}) {
	const baseURL = '/erm2-nwe9.json';
	const customFilter = `(descriptor in('PESTS') OR complaint_type = 'Rodent')`;
	const dateField = 'created_date';
	let records = await common.getRecords({
		moduleName,
		baseURL,
		customFilter,
		days,
		dateField,
		orderBy: dateField
	});

	records = cleanData(records);
	const permits = await getPermits(records);
	const results = applyPermits(records, permits);
	data = await common.convertToCSV(results, moduleName);
}

function getData(dataType) {
	return data ? data[dataType] : 'App still loading...';
}

module.exports = { refreshData, getData };