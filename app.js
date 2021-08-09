const axios = require('axios-cache-adapter');
const redis = require('redis');
const converter = require('json-2-csv');
const express = require('express');

const getDate = () => new Date().toLocaleString('en-US');

const redisClient = redis.createClient({
	url: process.env.REDIS_URL || 'redis://localhost',
})
const redisStore = new axios.RedisStore(redisClient);
const api = axios.setup({
	baseURL: 'https://data.cityofnewyork.us/resource',
	cache: {
		maxAge: 15 * 60 * 1000, // 15 min
		exclude: { query: false },
		redisStore
	}
});

let logMessages = [];

async function getResponse() {
	const response = {};
	const violationsNum = 750;
	const violationsURL = "/mkgf-zjhb.json?$order=inspectiondate%20DESC&$limit=" + violationsNum;

	logMessages.push(`[${getDate()}] Requesting ${violationsNum} violations...`);
	const violationsReq = await api.get(violationsURL);
	response.violations = violationsReq.data;
	
	let binSet = new Set();
	let numPermits = 0;

	for (let i in response.violations) {
		binSet.add(response.violations[i].bin);
		numPermits++;
	}

	const binsToRequest = `(%27${Array.from(binSet).join("%27,%27")}%27)`;
	const permitsURL = `/ipu4-2q9a.json?$where=bin__%20in${binsToRequest}&$limit=${violationsNum * 10}`;

	logMessages.push(`[${getDate()}] Filtering out ${numPermits - binSet.size} duplicate permits...`);
	logMessages.push(`[${getDate()}] Requesting ${binSet.size} permits...`);
	const permitsReq = await api.get(permitsURL);
	response.permits = permitsReq.data;

	const cacheLength = await api.cache.length();
	logMessages.push(`[${getDate()}] Cached ${cacheLength} API results for future requests...`);

	return response;
}

const formatDate = dateStr => new Date(dateStr).toISOString().substring(0,10);
const trimDescription = str => str.replace(/.+CONSISTING OF /g, '')
	.replace(/IN THE ENTIRE APARTMENT LOCATED AT /g, '')
	.replace(/, \d+?.. STORY, .+/g, '');

function parseResponse(response) {
	const { violations, permits } = response;

	const dataObj = {
		withContacts: [],
		withoutContacts: []
	};

	let violation;
	let violationId;
	let lastViolationId;

	// Check for violations with contact info
	for (let i in violations) {
		violation = {};

		for (let j in permits) {
			if (violations[i].bin == permits[j].bin__) {
				violationId = violations[i].violationid;

				if (violationId !== lastViolationId) {
					violation.violation_date = formatDate(violations[i].inspectiondate);
					violation.violation_address = `${violations[i].housenumber} ${violations[i].streetname} ${violations[i].apartment || violations[i].story} ${violations[i].boro} ${violations[i].zip}`;
					violation.description = trimDescription(violations[i].novdescription);
					violation.bin = violations[i].bin;

					// violation.permit_date = formatDate(permits[j].filing_date);
					violation.company = permits[j].owner_s_business_name;
					if (!violation.company || violation.company === 'NA' || violation.company === 'N/A')
						violation.company = '';
					violation.first_name = permits[j].owner_s_first_name;
					violation.last_name = permits[j].owner_s_last_name;
					violation.address = `${permits[j].owner_s_house__} ${permits[j].owner_s_house_street_name}`;
					violation.city = permits[j].city;
					violation.state = permits[j].state;
					violation.zip = permits[j].owner_s_zip_code;
					violation.phone = permits[j].owner_s_phone__;

					dataObj.withContacts.push(violation);
					lastViolationId = violationId;
				}
			}
		}
	}

	// Check for violations without contact info
	// TODO: Need to fix this logic
	// A violation without contact info has a BIN, but looking it up on Permits produces an empty dataset like this: []
	for (let i in violations) {
		violation = {};

		for (let j in permits) {
			if (violations[i].bin != permits[j].bin__) {
				violationId = violations[i].violationid;

				if (violationId !== lastViolationId) {
					violation.violation_date = formatDate(violations[i].inspectiondate);
					violation.violation_address = `${violations[i].housenumber} ${violations[i].streetname} ${violations[i].apartment || violations[i].story} ${violations[i].boro} ${violations[i].zip}`;
					violation.description = trimDescription(violations[i].novdescription);
					violation.bin = violations[i].bin;

					// violation.permit_date = formatDate(permits[j].filing_date);
					violation.company = permits[j].owner_s_business_name;
					if (!violation.company || violation.company === 'NA' || violation.company === 'N/A')
						violation.company = '';
					violation.first_name = permits[j].owner_s_first_name;
					violation.last_name = permits[j].owner_s_last_name;
					violation.address = `${permits[j].owner_s_house__} ${permits[j].owner_s_house_street_name}`;
					violation.city = permits[j].city;
					violation.state = permits[j].state;
					violation.zip = permits[j].owner_s_zip_code;
					violation.phone = permits[j].owner_s_phone__;

					dataObj.withoutContacts.push(violation);
					lastViolationId = violationId;
				}
			}
		}
	}

	logMessages.push(`[${getDate()}] Found ${Object.keys(dataObj.withContacts).length} violations with contact info...`);
	logMessages.push(`[${getDate()}] Found ${Object.keys(dataObj.withoutContacts).length} violations without contact info...`);

	return dataObj;
}

const app = express();

const dataCsv = {
	withContacts: [],
	withoutContacts: []
};

app.get('/refresh', async (req, res) => {
	const response = await getResponse();
	const results = parseResponse(response);
	dataCsv.withContacts = await converter.json2csvAsync(results.withContacts);
	dataCsv.withoutContacts = await converter.json2csvAsync(results.withoutContacts);
	logMessages.push(`[${getDate()}] Data refreshed and converted to CSV.`);
	logMessages.push(`[${getDate()}] ---`);
	res.header("Content-Type", "text/plain");
	res.send(logMessages.join("\n"));
});

app.get('/with-contact-info.csv', async (req, res) => {
	const action = req.query.action;
	res.header("Content-Disposition", `${action === 'download' ? 'attachment' : 'inline'};filename=with-contact-info.csv`);
	res.header("Content-Type", `text/${action === 'download' ? 'csv' : 'plain'}`)
	res.send(dataCsv.withContacts);
});

app.get('/without-contact-info.csv', async (req, res) => {
	const action = req.query.action;
	res.header("Content-Disposition", `${action === 'download' ? 'attachment' : 'inline'};filename=without-contact-info.csv`);
	res.header("Content-Type", `text/${action === 'download' ? 'csv' : 'plain'}`)
	res.send(dataCsv.withoutContacts);
});

app.use(express.static('public'));

const port = parseInt(process.env.PORT, 10) || 3000;
app.listen(port, () => {
	console.log(`[${getDate()}] App listening on port ${port}...`)
});

module.exports = app;
