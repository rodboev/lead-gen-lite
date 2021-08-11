const axios = require('axios-cache-adapter');
const redis = require('redis');
const converter = require('json-2-csv');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

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

// Real-time logging
const events = require('events');
const eventEmitter = new events.EventEmitter();
const history = [];

eventEmitter.on('logging', function (message) {
	history.push(message);
	io.emit('log_message', message);
});
io.on('connection', (socket) => {
	socket.emit('logging', history);
	io.emit('log_message', history.join(''));
});

// Helper functions
const getDate = () => new Date().toLocaleString('en-US');
const formatDate = dateStr => new Date(dateStr).toISOString().substring(0,10);
const trimDescription = str => str.replace(/.+CONSISTING OF /g, '')
	.replace(/IN THE ENTIRE APARTMENT LOCATED AT /g, '')
	.replace(/, \d+?.. STORY, .+/g, '');

// Prep violations array
async function getViolations(violationsMax = 1000) {
	const violationsURL = "/mkgf-zjhb.json?$order=inspectiondate%20DESC&$limit=" + violationsMax;

	eventEmitter.emit('logging', `[${getDate()}] Requesting ${violationsMax} violations...\n`);
	const violationsReq = await api.get(violationsURL);
	const violations = violationsReq.data;

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

	eventEmitter.emit('logging', `[${getDate()}] Combining descriptions for ${violationsMax - violations.length} violations...\n`);
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

	eventEmitter.emit('logging', `[${getDate()}] Found ${binSet.size} unique BINs. Requesting permits...\n`);
	const permitsReq = await api.get(permitsURL);
	const permits = permitsReq.data;

	return permits;
}

// Push data into separate categories
function processData(violations, permits) {
	const dataObj = {
		all: [],
		withContacts: [],
		withoutContacts: []
	};
	
	for (let i = 0; i < violations.length; i++) {
		let violation = Object.create(null);
		violation.date = formatDate(violations[i].inspectiondate);
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
		dataObj.all.push(violation);
	}

	return dataObj;
}

const dataCsv = Object.create(null);
const hyphenate = str => str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
const unhyphenate = str => str.replace(/-./g, letter => letter.substring(1).toUpperCase());
const removeExt = str => str.split('.')[0];

async function refreshData(violationsMax) {
	const violations = await getViolations(violationsMax);
	const permits = await getPermits(violations, violationsMax);
	const results = processData(violations, permits);

	for (const [dataType, dataValue] of Object.entries(results)) {
		eventEmitter.emit('logging', `[${getDate()}] Pushing ${Object.keys(dataValue).length} (${Math.round(Object.keys(dataValue).length / Object.keys(results.all).length * 100)}%) addresses to dob-${hyphenate(dataType)}.csv...\n`);
		dataCsv[dataType] = await converter.json2csvAsync(dataValue);
	}

	const cacheLength = await api.cache.length();
	eventEmitter.emit('logging', `[${getDate()}] ${cacheLength} external API calls cached. Done.\n`);
}

// App routes to handle requests
app.get('/refresh', async (req, res) => {
	const violationsMax = req.query.limit;
	await refreshData(violationsMax);
	res.end();
});

const csvHeader = action => ({
	"Content-Disposition": action === 'download' ? 'attachment' : 'inline',
	"Content-Type": `text/${action === 'download' ? 'csv' : 'plain'}`
});

app.get('/api/dob-:id', function(req , res){
	const action = req.query.action;
	res.set(csvHeader(action));
	console.log(`Requested ${req.params.id}, returning dataCsv.${removeExt(unhyphenate(req.params.id))}`);
	res.send(dataCsv[removeExt(unhyphenate(req.params.id))]);
});

app.use(express.static('public'));

const port = parseInt(process.env.PORT, 10) || 3000;
http.listen(port, async () => {
	console.log(`[${getDate()}] App listening on port ${port}...\n`);
	await refreshData();
});

module.exports = app;
