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
async function getPermits(records) {
	let uniqueRecords = [];

	for (const record of records) {
		// TODO: Add boro code
		if (!uniqueRecords.some(uniqueRecord => uniqueRecord.block === record.block && uniqueRecord.lot === record.lot)) {
			uniqueRecords.push({ block: record.block, lot: record.lot });
		}
	}

	// Build $where request string
	let where = '';
	const prefix = `(block in('`;
	const middle = `') AND lot in('`;
	const end = `'))`;
	let trippedLimit;
	
	for (const [i, record] of uniqueRecords.entries()) {
		// TODO: Batch requests over 32k
		if (where.length < 32768) {
			where += `${prefix}${record.block}${middle}${record.lot}${end} OR `;
		}
		else {
			trippedLimit = true;
		}
	}
	where = utils.removeLast(where, ' OR ');

	const dateString = 'filing_date';

	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Requesting permits for ${utils.addCommas(uniqueRecords.length)} unique BBLs...\n`);
	if (trippedLimit) {
		eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) WARNING: Permits request shortened. This will result in fewer matches.\n`);
	}

	const permits = await common.fetchData({
		moduleName,
		baseURL: common.permitsAPI,
		where,
		orderBy: dateString,
		requestType: 'permits'
	});

	const uniquePermits = common.getUniquePermits(permits, moduleName);

	return uniquePermits;
}

// Try to match up every record with an owner
function constructResults(records, permits) {
	const results = {
		withContacts: [],
		withoutContacts: []
	};

	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Applying ${utils.addCommas(permits.length)} permits to ${utils.addCommas(records.length)} records...\n`);

	for (const record of records) {
		// Find most recent owner that matches block and lot
		const permit = permits.find(permit => permit.block === record.block && permit.lot === record.lot);

		// Construct notes field, preventing empty fields from being added
		let notes = '';
		if (record.house_number) {
			notes += record.house_number + ' ';
		}
		if (record.street_name) {
			notes += record.street_name + ' ';
		}
		notes += `${record.borough && record.borough} ${record.zip_code} ${record.inspection_type} INSPECTION: ${record.result}`;
		notes = notes.toUpperCase();
		
		// Construct a new entry since we need to transform the existing fields
		const newEntry = {
			date: record.inspection_date,
			notes,
			...common.getPermitFields(permit),
		}
	
		if (newEntry.phone) {
			results.withContacts.push(newEntry);
		}
		else {
			results.withoutContacts.push(newEntry);
		}
	}

	return results;
}

let data;

async function refreshData({days}) {
	const baseURL = '/p937-wjvj.json';
	const where = `result not in('Passed')`;
	const dateField = 'inspection_date';
	let records;

	records = await common.getRecords({	moduleName,	baseURL, where, days, dateField, orderBy: dateField	});
	records = cleanData(records);
	const permits = await getPermits(records);
	const results = constructResults(records, permits);
	common.data.json.inspections = results;
	common.data.csv.inspections = await common.convertToCSV(results, moduleName);
}

module.exports = { refreshData };