const path = require('path');

const api = require('../lib/api');
const utils = require('../lib/utils');
const eventEmitter = require('../lib/events');
const common = require('./common.js');

const moduleName = utils.capitalize(path.basename(module.filename, path.extname(module.filename)).replace(/^(city)/, ''));

function cleanData(records) {
	// Remove records with missing inspection dates or dates in the future
	let newRecords = [];
	const today = new Date();
	for (record of records) {
		if (record.inspection_date && new Date(record.inspection_date) < today) {
			record.inspection_date = utils.formatDate(record.inspection_date);
			newRecords.push(record);
		}
	}
	records = newRecords;

	// Add zeroes to 5 digits
	for (record of records) {
		record.block = record.block.padStart(5, '0');
		record.lot = record.lot.padStart(5, '0');
	}
	return records;
}

// Extract BBLs (block and lot numbers) and request permits
async function getPermits(records, queryLimit) {
	let uniqueRecords = [];

	for (const record of records) {
		// TODO: Add boro code
		if (!uniqueRecords.some(uniqueRecord => uniqueRecord.block === record.block && uniqueRecord.lot === record.lot)) {
			uniqueRecords.push({ block: record.block, lot: record.lot });
		}
	}

	// Build request string for Socrata API query
	let requestString = '';
	const prefix = `(block in('`;
	const middle = `') AND lot in('`;
	const end = `'))`;
	
	for (const [i, record] of uniqueRecords.entries()) {
		// TODO: Batch requests over 32k
		if (requestString.length < 32768) {
			requestString += `${prefix}${record.block}${middle}${record.lot}${end} OR `;
		}
	}
	requestString = utils.removeLast(requestString, ' OR ');

	const permitsURL = `/ipu4-2q9a.json?$where=${requestString}&$order=filing_date DESC&$limit=${10000}`;

	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Requesting permits for ${uniqueRecords.length} unique BBLs...\n`);

	// console.log('Requesting: ' + permitsURL);

	const permits = await common.getPermitsByURL(permitsURL, moduleName);

	return permits;
}

// Try to match up every record with an owner
function applyPermits(records, permits) {
	const dataObj = {
		withContacts: [],
		withoutContacts: []
	};

	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Applying ${permits.length} permits to ${records.length} records...\n`);

	for (const record of records) {
		// Find most recent owner that matches block and lot
		const permit = permits.find(permit => permit.block === record.block && permit.lot === record.lot);

		// Construct a new entry since we need to transform the existing fields
		const newEntry = common.applyPermit(record, permit, {
			date: record.inspection_date,
			notes: `${record.house_number} ${record.street_name} ${record.borough && record.borough} ${record.zip_code} ${record.inspection_type} INSPECTION: ${record.result}`
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

async function refreshData(queryLimit, days) {
	const baseURL = '/p937-wjvj.json';
	const customFilter = `result not in('Passed')`;
	const dateField = 'inspection_date';
	let records = await common.getRecords({
		moduleName,
		baseURL,
		customFilter,
		days,
		queryLimit,
		dateField,
		orderBy: dateField
	});

	records = cleanData(records);
	const permits = await getPermits(records, queryLimit);
	const results = applyPermits(records, permits);
	data = await common.convertToCSV(results, moduleName);
}

function getData(dataType) {
	return data && data[dataType];
}

module.exports = { refreshData, getData };