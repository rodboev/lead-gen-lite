const axios = require('axios-cache-adapter');
const converter = require('json-2-csv');
const express = require('express');

const getDate = () => new Date().toLocaleString('en-US');

const api = axios.setup({
	baseURL: 'https://data.cityofnewyork.us/resource',
	cache: {
		maxAge: 15 * 60 * 1000, // 15 min
		exclude: { query: false }
	}
});

async function main() {
	const violationsNum = 2000;
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
	const permitsURL = `/ipu4-2q9a.json?$select=bin__,filing_date,owner_s_business_name,owner_s_first_name,owner_s_last_name,owner_s_house__,owner_s_house_street_name,city,state,owner_s_zip_code,owner_s_phone__&$where=bin__%20in${binsToRequest}&$limit=${violationsNum * 10}`;

	console.log(`[${getDate()}] Filtered out ${numPermits - binSet.size} permits.`);
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
			if (violations[i].bin == permits[j].bin__) {
				// obj.violation_id = violations[i].violationid;
				violationId = violations[i].violationid;
				obj.violation_date = formatDate(violations[i].inspectiondate);
				obj.violation_address = `${violations[i].housenumber} ${violations[i].streetname} ${violations[i].apartment || violations[i].story} ${violations[i].boro} ${violations[i].zip}`;
				obj.violation = trimDescription(violations[i].novdescription);
				obj.bin = violations[i].bin;

				if (violationId !== lastViolationId) {
					// obj.permit_date = formatDate(permits[j].filing_date);
					obj.company = permits[j].owner_s_business_name;
					if (obj.company === '' || obj.company === 'NA' || obj.company === 'N/A')
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

	const cacheLength = await api.cache.length();
	console.log(`[${getDate()}] Cached ${cacheLength} API requests.`);

	console.log(`[${getDate()}] Returned ${Object.keys(violationsArr).length} records.`);
	const csvOutput =  await converter.json2csvAsync(violationsArr);
	return csvOutput;
}

const app = express();

app.get('/leads.csv', async (req, res) => {
	const response = await main();
	res.header('Content-Type', 'text/csv').send(response);
});

app.get('/leads.txt', async (req, res) => {
	const response = await main();
	res.header('Content-Type', 'text/plain').send(response);
});

const port = parseInt(process.env.PORT, 10) || 3000;
app.listen(port, () => {
	console.log(`[${getDate()}] App listening on port ${port}...`)
});

module.exports = app;
