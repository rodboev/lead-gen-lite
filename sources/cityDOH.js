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

// For DOH inspections we are not using any permit data
// Instead the contact info is the place the inspection occured
function constructResults(records) {
	const results = {
		withContacts: [],
		withoutContacts: []
	};

	for (record of records) {
		// Construct a new entry since we need to transform the existing fields
		const newEntry = {
			date: utils.formatDate(record.inspection_date),
			notes: record.violation_description.toUpperCase(),
			company: record.dba.toUpperCase(),
			address: [record.building, record.street].filter(Boolean).join(' '),
			city: record.boro.toUpperCase(),
			zip: record.zipcode,
			phone: record.phone,
		}

		if (newEntry.phone) {
			results.withContacts.push(newEntry);
		}
		else {
			results.withoutContacts.push(newEntry);
		}
	}

	for (const dataSet in results) {
		results[dataSet] = common.combineNotes({
			records: results[dataSet],
			moduleName,
		});
	}

	return results;
}

let data;

async function refreshData({days}) {
	const baseURL = '/43nn-pn8j.json';
	const where = `violation_code in('04L','04K','04M','04N','08A','08C')`;
	const dateField = 'inspection_date';
	let records;

	records = await common.getRecords({	moduleName,	baseURL, where, days, dateField, orderBy: dateField	});
	records = cleanData(records);
	const results = constructResults(records);
	common.data.json.cityDOH = results;
	common.data.csv.cityDOH = await common.convertToCSV(results, moduleName);
}

module.exports = { refreshData };