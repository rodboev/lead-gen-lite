var path = require('path');

const api = require('../lib/api');
const utils = require('../lib/utils');
const eventEmitter = require('../lib/events');
const common = require('./common.js');

const moduleName = path.basename(module.filename, path.extname(module.filename)).replace(/^(city)/, '');

function cleanData(records) {
	// Trim descriptions
	const trimDescription = str => str.replace(/.+CONSISTING OF /g, '')
		.replace(/IN THE ENTIRE APARTMENT LOCATED AT /g, '')
		.replace(/, \d+?.. STORY, .+/g, '');

	for (const record of records) {
		record.novdescription = trimDescription(record.novdescription);
	}

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

		// Construct notes field
		let notes = `${record.housenumber} ${record.streetname} ${record.boro} ${record.zip} HAS ${record.novdescription}`;
		notes = notes.toUpperCase();

		// Construct a new entry since we need to transform the existing fields
		const newEntry = {
			date: utils.formatDate(record.inspectiondate),
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

	for (const dataSet in results) {
		results[dataSet] = common.combineNotes({
			records: results[dataSet],
			moduleName,
		});
	}

	return results;
}

async function refreshData({days}) {
	const baseURL = '/wvxf-dwi5.json';
	const where = `starts_with(novdescription, 'HMC')`;
	const dateField = 'inspectiondate';
	let records;
	
	records = await common.getRecords({ moduleName,	baseURL, where, days, dateField, orderBy: dateField });
	records = cleanData(records);
	const permits = await getPermits(records);
	const results = constructResults(records, permits);
	common.data.json.cityDOB = results;
	common.data.csv.cityDOB = await common.convertToCSV(results, moduleName);
}

module.exports = { refreshData };