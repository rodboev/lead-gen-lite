const path = require('path');

const api = require('../lib/api');
const utils = require('../lib/utils');
const eventEmitter = require('../lib/events');
const common = require('./common.js');

const moduleName = path.basename(module.filename, path.extname(module.filename)).replace(/^(city)/, '');

function cleanData(records) {
	// Prefix action field if it's nonstandard
	const standardAction = 'Violations were cited in the following area(s).';
	for (const record of records) {
		if (record.action !== standardAction) {
			record.violation_description = record.action + record.violation_description;
		}
	}

	// Combine multiple subsequent descriptions by folding onto previous and removing new entry
	const originalLength = records.length;
	for (const [i, record] of records.entries()) {
		if (records[i - 1] && record.building === records[i - 1].building && record.street === records[i - 1].street) {
			records[i - 1].violation_description += ` AND ${record.violation_description}`;
			records.splice(i, 1);
		}
	}

	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Combining ${utils.addCommas(originalLength - records.length)} violation descriptions...\n`);
	return records;
}

// Extract BINs and request permits
async function getPermits(records) {
	let uniqueBINs = new Set();

	for (const record of records) {
		uniqueBINs.add(record.bin);
	}

	// Build $where request string
	const where = `bin__ in('${Array.from(uniqueBINs).join("','")}')`;
	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Requesting permits for ${utils.addCommas(uniqueBINs.size)} unique BINs...\n`);

	const dateString = 'filing_date';
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

	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Applying ${utils.addCommas(permits.length)} permits to ${utils.addCommas(records.length)} violations...\n`);

	for (record of records) {
		// Find most recent owner by BIN
		const permit = permits.find(permit => permit.bin__ === record.bin);

		// Construct a new entry since we need to transform the existing fields
		const newEntry = common.applyPermit(record, permit, {
			date: utils.formatDate(record.inspection_date),
			notes: `${record.dba}, ${utils.formatPhoneNumber(record.phone)}, AT ${record.building} ${record.street}, ${record.boro.toUpperCase()} ${record.zipcode} HAS VIOLATION: ${record.violation_description}`
		});

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
	const baseURL = '/43nn-pn8j.json';
	const where = `action not in('No violations were recorded at the time of this inspection.')`;
	const dateField = 'inspection_date';
	let records;

	records = await common.getRecords({	moduleName,	baseURL, where, days, dateField, orderBy: dateField	});
	records = cleanData(records);
	const permits = await getPermits(records);
	const results = constructResults(records, permits);
	common.data.json.cityDOH = results;
	common.data.csv.cityDOH = await common.convertToCSV(results, moduleName);
}

module.exports = { refreshData };