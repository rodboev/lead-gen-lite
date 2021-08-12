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

	for (let i = 0; i < records.length; i++) {
		records[i].novdescription = trimDescription(records[i].novdescription);
	}

	// Combine descriptions
	const originalLength = records.length;
	for (let i = 0; i < records.length; i++) {
		if (records[i - 1] && records[i].housenumber === records[i - 1].housenumber && records[i].streetname === records[i - 1].streetname && records[i].apartment === records[i - 1].apartment) {
			records[i - 1].novdescription += ` AND ${records[i].novdescription}`;
			records.splice(i, 1);
		}
	}

	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Combining ${originalLength - records.length} violation descriptions...\n`);
	return records;
}

// Extract BINs and request permits
async function getPermits(records, queryLimit = 1000) {
	let uniqueBINs = new Set();

	for (let i = 0; i < records.length; i++) {
		uniqueBINs.add(records[i].bin);
	}

	// Build request string and query Socrata API
	const requestString = `('${Array.from(uniqueBINs).join("','")}')`;
	const permitsURL = `/ipu4-2q9a.json?$where=bin__ in${requestString}&$limit=${queryLimit * 10}`;
	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Requesting ${uniqueBINs.size} permits by unique BIN...\n`);
	const permits = await common.getPermitsByURL(permitsURL, moduleName);

	return permits;
}

// Push data into separate categories
function applyPermits(records, permits) {
	const dataObj = {
		withContacts: [],
		withoutContacts: []
	};

	eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Applying ${permits.length} permits to ${records.length} violations...\n`);

	for (let i = 0; i < records.length; i++) {
		let record = Object.create(null);
		record.date = utils.formatDate(records[i].inspectiondate);
		record.notes = `${records[i].housenumber} ${records[i].streetname} ${records[i].boro} ${records[i].zip} HAS ${records[i].novdescription}`;
	
		permit = permits.find(permit => records[i].bin === permit.bin__);
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

let data;

async function refreshData(queryLimit) {
	const recordsURL = '/mkgf-zjhb.json?$order=inspectiondate DESC';
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