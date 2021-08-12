const api = require('../lib/api');
const utils = require('../lib/utils');
const eventEmitter = require('../lib/events');
const common = require('./common.js');

function cleanData(records) {
	const originalLength = records.length;

	const trimDescription = str => str.replace(/.+CONSISTING OF /g, '')
		.replace(/IN THE ENTIRE APARTMENT LOCATED AT /g, '')
		.replace(/, \d+?.. STORY, .+/g, '');

	// Trim descriptions
	for (let i = 0; i < records.length; i++) {
		records[i].novdescription = trimDescription(records[i].novdescription);
	}

	// Combine descriptions
	for (let i = 0; i < records.length; i++) {
		if (records[i - 1] && records[i].housenumber === records[i - 1].housenumber && records[i].streetname === records[i - 1].streetname && records[i].apartment === records[i - 1].apartment) {
			records[i - 1].novdescription += ` AND ${records[i].novdescription}`;
			records.splice(i, 1);
		}
	}

	eventEmitter.emit('logging', `[${utils.getDate()}] (DOB) Combining descriptions for ${originalLength - records.length} DOB violations...\n`);
	return records;
}

// Extract BINs from DOB violations and request permits
async function getPermits(records, queryLimit = 1000) {
	let bins = new Set();
	let numPermits = 0;

	for (let i = 0; i < records.length; i++) {
		bins.add(records[i].bin);
		numPermits++;
	}

	const requestString = `('${Array.from(bins).join("','")}')`;
	const permitsURL = `/ipu4-2q9a.json?$where=bin__ in${requestString}&$limit=${queryLimit * 10}`;

	eventEmitter.emit('logging', `[${utils.getDate()}] (DOB) Found ${bins.size} unique BINs. Requesting permits...`);
	let permits = [];
	try {
		const permitsReq = await api.get(permitsURL);
		permits = permitsReq.data;
	}
	catch (err) {
		eventEmitter.emit('logging', ` ${err.message}\n`);
	}
	eventEmitter.emit('logging', ` Received ${permits.length}.\n`);

	return permits;
}

// Push data into separate categories
function processData(records, permits) {
	const dataObj = {
		withContacts: [],
		withoutContacts: []
	};

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

async function refreshData(queryLimit) {
	let records = await common.getRecords('/mkgf-zjhb.json?$order=inspectiondate DESC', queryLimit, '311');
	records = cleanData(records);
	const permits = await getPermits(records, queryLimit);
	const results = processData(records, permits);
	const csvData = await common.convertToCSV(results, 'DOB');
	return csvData;
}

module.exports = { refreshData };