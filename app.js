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

async function getResponse(limit = 1000) {
	const response = Object.create(null);
	const violationsURL = "/mkgf-zjhb.json?$order=inspectiondate%20DESC&$limit=" + limit;

	logMessages.push(`[${getDate()}] Requesting ${limit} violations...`);
	const violationsReq = await api.get(violationsURL);
	response.violations = violationsReq.data;
	
	let binSet = new Set();
	let numPermits = 0;

	for (let i in response.violations) {
		binSet.add(response.violations[i].bin);
		numPermits++;
	}

	const binsToRequest = `(%27${Array.from(binSet).join("%27,%27")}%27)`;
	const permitsURL = `/ipu4-2q9a.json?$where=bin__%20in${binsToRequest}&$limit=${limit * 10}`;

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

function parseData(responseData) {
	let { violations, permits } = responseData;

	const dataObj = {
		all: [],
		withContacts: [],
		withoutContacts: []
	};

	for (let i in violations) {
		let violation = Object.create(null);
		violation.violation_date = formatDate(violations[i].inspectiondate);
		violation.violation_address = `${violations[i].housenumber} ${violations[i].streetname} ${violations[i].apartment || violations[i].story} ${violations[i].boro} ${violations[i].zip}`;
		violation.description = trimDescription(violations[i].novdescription);
		violation.bin = violations[i].bin;

		permit = permits.find(permit => violation.bin === permit.bin__);
		if (permit) {
			violation.company = permit.owner_s_business_name;
			if (!violation.company || violation.company === 'NA' || violation.company === 'N/A')
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
		dataObj.all.push(violation);
	}

	logMessages.push(`[${getDate()}] Saving ${Object.keys(dataObj.all).length} total violations...`);
	logMessages.push(`[${getDate()}] Saving ${Object.keys(dataObj.withContacts).length} violations with contact info...`);
	logMessages.push(`[${getDate()}] Saving ${Object.keys(dataObj.withoutContacts).length} violations without contact info...`);

	return dataObj;
}

const dataCsv = Object.create(null);

async function refreshData(limit = 1000) {
	const responseData = await getResponse(limit);
	const results = parseData(responseData);

	dataCsv.all = await converter.json2csvAsync(results.all);
	dataCsv.withContacts = await converter.json2csvAsync(results.withContacts);
	dataCsv.withoutContacts = await converter.json2csvAsync(results.withoutContacts);
	logMessages.push(`[${getDate()}] Data refreshed and converted to CSV.`);
	logMessages.push(`---`);
}

const app = express();

app.get('/refresh', async (req, res) => {
	const limit = req.query.limit;
	res.header("Content-Type", "text/plain");
	await refreshData(limit);
	res.send(logMessages.join("\n"));
	console.log(logMessages.join("\n"));
});

const csvHeader = action => ({
	"Content-Disposition": action === 'download' ? 'attachment' : 'inline',
	"Content-Type": `text/${action === 'download' ? 'csv' : 'plain'}`
});

app.get('/all.csv', async (req, res) => {
	const action = req.query.action;
	res.set(csvHeader(action));
	res.send(dataCsv.all);
});

app.get('/with-contact-info.csv', async (req, res) => {
	const action = req.query.action;
	res.set(csvHeader(action));
	res.send(dataCsv.withContacts);
});

app.get('/without-contact-info.csv', async (req, res) => {
	const action = req.query.action;
	res.set(csvHeader(action));
	res.send(dataCsv.withoutContacts);
});

app.use(express.static('public'));

const port = parseInt(process.env.PORT, 10) || 3000;
app.listen(port, async () => {
	console.log(`[${getDate()}] App listening on port ${port}...`);
	await refreshData();
	console.log(logMessages.join("\n"));
});

module.exports = app;
