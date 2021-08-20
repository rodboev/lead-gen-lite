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

	// Combine multiple subsequent descriptions by folding onto previous and removing new entry
	// TODO: Parse list and combine all descriptions where the same address and the date are equal
	const originalLength = records.length;
	for (const [i, record] of records.entries()) {
		if (records[i - 1] && record.housenumber === records[i - 1].housenumber && record.streetname === records[i - 1].streetname && record.apartment === records[i - 1].apartment) {
			records[i - 1].novdescription += ` AND ${record.novdescription}`;
			records.splice(i, 1);
		}
	}

	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Combining ${utils.addCommas(originalLength - records.length)} ${moduleName} violation descriptions...\n`);
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
			date: utils.formatDate(record.inspectiondate),
			notes: `${record.housenumber} ${record.streetname} ${record.boro} ${record.zip} HAS ${record.novdescription}`
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

async function refreshData({days}) {
	const baseURL = '/mkgf-zjhb.json';
	const dateField = 'inspectiondate';
	let records;
	
	records = await common.getRecords({ moduleName,	baseURL, days, dateField, orderBy: dateField });
	records = cleanData(records);
	const permits = await getPermits(records);
	const results = constructResults(records, permits);
	common.data.json.cityDOB = results;
	common.data.csv.cityDOB = await common.convertToCSV(results, moduleName);
}

module.exports = { refreshData };