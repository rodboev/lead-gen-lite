
const converter = require('json-2-csv');

const api = require('../lib/api');
const utils = require('../lib/utils');
const eventEmitter = require('../lib/events');

// Prep violations array
async function getViolations(queryLimit = 1000) {
	const recordsURL = "/mkgf-zjhb.json?$order=inspectiondate DESC&$limit=" + queryLimit;

	eventEmitter.emit('logging', `[${utils.getDate()}] (DOB) Requesting ${queryLimit} DOB violations...`);
	let records;
	try {
		const recordsReq = await api.get(recordsURL);
		records = recordsReq.data;
	}
	catch (err) {
		eventEmitter.emit('logging', ` error: ${err.response}\n`);
	}
	eventEmitter.emit('logging', ` received.\n`);

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

	eventEmitter.emit('logging', `[${utils.getDate()}] (DOB) Combining descriptions for ${queryLimit - records.length} DOB violations...\n`);
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
		eventEmitter.emit('logging', ` error: ${err.response}\n`);
	}
	eventEmitter.emit('logging', ` received.\n`);

	return permits;
}

// Push data into separate categories
function processData(records, permits) {
	eventEmitter.emit('logging', `[${utils.getDate()}] (DOB) Received ${permits.length} permits. Filtering and applying...\n`);

	const dataObj = {
		withContacts: [],
		withoutContacts: []
	};

	for (let i = 0; i < records.length; i++) {
		let violation = Object.create(null);
		violation.date = utils.formatDate(records[i].inspectiondate);
		violation.notes = `${records[i].housenumber} ${records[i].streetname} ${records[i].boro} ${records[i].zip} HAS ${records[i].novdescription}`;
		
		permit = permits.find(permit => records[i].bin === permit.bin__);
		if (permit && permit.owner_s_phone__) {
			violation.company = permit.owner_s_business_name || '';
			if (violation.company === 'NA' || violation.company === 'N/A')
				violation.company = '';
			violation.first_name = permit.owner_s_first_name;
			violation.last_name = permit.owner_s_last_name;
			violation.address = `${permit.owner_s_house__} ${permit.owner_s_house_street_name}`;
			violation.city = permit.city;
			violation.state = permit.state;
			violation.zip = permit.owner_s_zip_code;
			violation.phone = permit.owner_s_phone__;
			dataObj.withContacts.push(violation);
		}
		else {
			dataObj.withoutContacts.push(violation);
		}
	}

	return dataObj;
}

const dataCsv = Object.create(null);

async function refreshData(queryLimit) {
	const records = await getViolations(queryLimit);
	const permits = await getPermits(records, queryLimit);
	const results = processData(records, permits);

	let totalCount = 0;
	for (const dataValue of Object.values(results)) {
		totalCount += dataValue.length;
	}

	for (const [dataType, dataValue] of Object.entries(results)) {
		eventEmitter.emit('logging', `[${utils.getDate()}] (DOB) Pushing ${Object.keys(dataValue).length} addresses (${Math.round(Object.keys(dataValue).length / totalCount * 100)}%) to dob-${utils.hyphenate(dataType)}.csv...\n`);
		dataCsv[dataType] = await converter.json2csvAsync(dataValue);
	}

	const cacheLength = await api.cache.length();
	eventEmitter.emit('logging', `[${utils.getDate()}] (DOB) ${cacheLength} external API calls cached. Done.\n`);
}

module.exports = { getViolations, getPermits, processData, refreshData, dataCsv };