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

async function main() {
	const violationsNum = 750;
	const violationsURL = "/mkgf-zjhb.json?$order=inspectiondate%20DESC&$limit=" + violationsNum;

	console.log(`[${getDate()}] Requesting ${violationsNum} violations...`);
	const violationsReq = await api.get(violationsURL);
	const violations = violationsReq.data;
	
	let binSet = new Set();
	let numPermits = 0;

	for (let i in violations) {
		binSet.add(violations[i].bin);
		numPermits++;
	}

	const binsToRequest = `(%27${Array.from(binSet).join("%27,%27")}%27)`;
	const permitsURL = `/ipu4-2q9a.json?$where=bin__%20in${binsToRequest}&$limit=${violationsNum * 10}`;

	console.log(`[${getDate()}] Filtering out ${numPermits - binSet.size} duplicate permits...`);
	console.log(`[${getDate()}] Requesting ${binSet.size} permits...`);
	const permitsReq = await api.get(permitsURL);
	const permits = permitsReq.data;

	let violationsArr = [];
	let obj;
	let violationId;
	let lastViolationId;

	const formatDate = dateStr => new Date(dateStr).toISOString().substring(0,10);
	const trimDescription = str => str.replace(/.+CONSISTING OF /g, '')
		.replace(/IN THE ENTIRE APARTMENT LOCATED AT /g, '')
		.replace(/, \d+?.. STORY, .+/g, '');

	for (let i in violations) {
		obj = {};
		
		for (let j in permits) {
			// TODO: push violations with BINs that don't have a matching permit BIN into a separate csv
			if (violations[i].bin == permits[j].bin__) {
				violationId = violations[i].violationid;
				obj.violation_date = formatDate(violations[i].inspectiondate);
				obj.violation_address = `${violations[i].housenumber} ${violations[i].streetname} ${violations[i].apartment || violations[i].story} ${violations[i].boro} ${violations[i].zip}`;
				obj.description = trimDescription(violations[i].novdescription);
				obj.bin = violations[i].bin;

				if (violationId !== lastViolationId) {
					// obj.permit_date = formatDate(permits[j].filing_date);
					obj.company = permits[j].owner_s_business_name;
					if (!obj.company || obj.company === 'NA' || obj.company === 'N/A')
						obj.company = '';
					obj.first_name = permits[j].owner_s_first_name;
					obj.last_name = permits[j].owner_s_last_name;
					obj.address = `${permits[j].owner_s_house__} ${permits[j].owner_s_house_street_name}`;
					obj.city = permits[j].city;
					obj.state = permits[j].state;
					obj.zip = permits[j].owner_s_zip_code;
					obj.phone = permits[j].owner_s_phone__;

					violationsArr.push(obj);
					lastViolationId = violationId;
				}
			}
		}
	}

	console.log(`[${getDate()}] Returning ${Object.keys(violationsArr).length} records with matching BINs...`);

	const cacheLength = await api.cache.length();
	console.log(`[${getDate()}] Cached ${cacheLength} API results for future requests...`);

	const csvOutput =  await converter.json2csvAsync(violationsArr);
	return csvOutput;
}

const app = express();

app.get('/leads.csv', async (req, res) => {
	const response = await main();
	res.header('Content-Type', 'text/csv').send(response);
});

app.get('/', async (req, res) => {
	const response = await main();
	res.header('Content-Type', 'text/plain').send(response);
});

const port = parseInt(process.env.PORT, 10) || 3000;
app.listen(port, () => {
	console.log(`[${getDate()}] App listening on port ${port}...`)
});

module.exports = app;
