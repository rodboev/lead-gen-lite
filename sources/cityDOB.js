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

	// Combine descriptions by folding onto previous and removing new entry
	const originalLength = records.length;
	for (const [i, record] of records.entries()) {
		if (records[i - 1] && record.housenumber === records[i - 1].housenumber && record.streetname === records[i - 1].streetname && record.apartment === records[i - 1].apartment) {
			records[i - 1].novdescription += ` AND ${record.novdescription}`;
			records.splice(i, 1);
		}
	}

	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Combining ${originalLength - records.length} violation descriptions...\n`);
	return records;
}

// Extract BINs and request permits
async function getPermits(records) {
	let uniqueBINs = new Set();

	for (const record of records) {
		uniqueBINs.add(record.bin);
	}

	// Build request string and query Socrata API
	const requestString = `('${Array.from(uniqueBINs).join("','")}')`;
	const permitsURL = `/ipu4-2q9a.json?$where=bin__ in${requestString}`;
	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Requesting permits for ${uniqueBINs.size} unique BINs...\n`);
	const permits = await common.getPermitsByURL(permitsURL, moduleName);

	return permits;
}

// Try to match up every record with an owner
function applyPermits(records, permits) {
	const dataObj = {
		withContacts: [],
		withoutContacts: []
	};

	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Applying ${permits.length} permits to ${records.length} violations...\n`);

	for (record of records) {
		// Find most recent owner by BIN
		const permit = permits.find(permit => permit.bin__ === record.bin);

		// Construct a new entry since we need to transform the existing fields
		const newEntry = common.applyPermit(record, permit, {
			date: utils.formatDate(record.inspectiondate),
			notes: `${record.housenumber} ${record.streetname} ${record.boro} ${record.zip} HAS ${record.novdescription}`
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
	const baseURL = '/mkgf-zjhb.json';
	const dateField = 'inspectiondate';
	let records = await common.getRecords({
		moduleName,
		baseURL, 
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