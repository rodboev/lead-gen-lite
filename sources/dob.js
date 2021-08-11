
const converter = require('json-2-csv');

const api = require('../lib/api');
const utils = require('../lib/utils');
const eventEmitter = require('../lib/events');

// Prep violations array
async function getViolations(violationsMax = 1000) {
	const violationsURL = "/mkgf-zjhb.json?$order=inspectiondate%20DESC&$limit=" + violationsMax;

	eventEmitter.emit('logging', `[${utils.getDate()}] Requesting ${violationsMax} violations...\n`);
	const violationsReq = await api.get(violationsURL);
	const violations = violationsReq.data;

	const trimDescription = str => str.replace(/.+CONSISTING OF /g, '')
		.replace(/IN THE ENTIRE APARTMENT LOCATED AT /g, '')
		.replace(/, \d+?.. STORY, .+/g, '');

	// Trim descriptions
	for (let i = 0; i < violations.length; i++) {
		violations[i].novdescription = trimDescription(violations[i].novdescription);
	}

	// Combine descriptions
	for (let i = 0; i < violations.length; i++) {
		if (violations[i - 1] && violations[i].housenumber === violations[i - 1].housenumber && violations[i].streetname === violations[i - 1].streetname && violations[i].apartment === violations[i - 1].apartment) {
			violations[i - 1].novdescription += ` AND ${violations[i].novdescription}`;
			violations.splice(i, 1);
		}
	}

	eventEmitter.emit('logging', `[${utils.getDate()}] Combining descriptions for ${violationsMax - violations.length} violations...\n`);
	return violations;
}

// Extract BINs from violations and request permits
async function getPermits(violations, violationsMax = 1000) {
	let binSet = new Set();
	let numPermits = 0;

	for (let i in violations) {
		binSet.add(violations[i].bin);
		numPermits++;
	}

	const binsToRequest = `(%27${Array.from(binSet).join("%27,%27")}%27)`;
	const permitsURL = `/ipu4-2q9a.json?$where=bin__%20in${binsToRequest}&$limit=${violationsMax * 10}`;

	eventEmitter.emit('logging', `[${utils.getDate()}] Found ${binSet.size} unique BINs. Requesting permits...\n`);
	const permitsReq = await api.get(permitsURL);
	const permits = permitsReq.data;

	return permits;
}

// Push data into separate categories
function processData(violations, permits) {
	const dataObj = {
		// all: [],
		withContacts: [],
		withoutContacts: []
	};
	
	for (let i = 0; i < violations.length; i++) {
		let violation = Object.create(null);
		violation.date = utils.formatDate(violations[i].inspectiondate);
		violation.notes = `${violations[i].housenumber} ${violations[i].streetname} ${violations[i].boro} ${violations[i].zip} HAS ${violations[i].novdescription}`;
		
		permit = permits.find(permit => violations[i].bin === permit.bin__);
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
		// dataObj.all.push(violation);
	}

	return dataObj;
}

const dataCsv = Object.create(null);

async function refreshData(violationsMax) {
	const violations = await getViolations(violationsMax);
	const permits = await getPermits(violations, violationsMax);
	const results = processData(violations, permits);

	let totalCount = 0;
	for (const dataValue of Object.values(results)) {
		totalCount += dataValue.length;
	}

	for (const [dataType, dataValue] of Object.entries(results)) {
		eventEmitter.emit('logging', `[${utils.getDate()}] Pushing ${Object.keys(dataValue).length} addresses (${Math.round(Object.keys(dataValue).length / totalCount * 100)}%) to dob-${utils.hyphenate(dataType)}.csv...\n`);
		dataCsv[dataType] = await converter.json2csvAsync(dataValue);
	}

	const cacheLength = await api.cache.length();
	eventEmitter.emit('logging', `[${utils.getDate()}] ${cacheLength} external API calls cached. Done.\n`);
}

module.exports = { getViolations, getPermits, processData, refreshData, dataCsv };