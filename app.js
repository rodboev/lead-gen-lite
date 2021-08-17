const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const converter = require('json-2-csv');

const api = require('./lib/api');
const utils = require('./lib/utils');
const eventEmitter = require('./lib/events');
const cityDOB = require('./sources/cityDOB');
const city311 = require('./sources/city311');
const inspections = require('./sources/inspections');
const cityDOH = require('./sources/cityDOH');
const common = require('./sources/common');

// Real-time logging
const history = [];
eventEmitter.on('logging', (message) => {
	history.push(message);
	io.emit('log_message', message);
});
io.on('connection', (socket) => {
	socket.emit('logging', history);
	io.emit('log_message', history.join(''));
});

// App routes to handle requests
app.get('/refresh/all', async (req, res) => {
	let refreshRequests = [];
	try {
		Object.keys(common.data.json).forEach(source => {
			refreshRequests.push(eval(source).refreshData({days: req.query.days || common.defaultDays }));
		});
	}
	catch (err) {
		res.send(`${err.message}`);
	}
	Promise.all(refreshRequests).then(async () => {
		await logSummary();
	});
	res.end();
});

app.get('/refresh/:id', async (req, res) => {
	let source = req.params.id;

	// Return 'city311', 'cityDOB', 'inspections'...
	if (source === 'DOB' || source === '311' || source === 'DOH') source =  'city' + source;

	if (common.data.csv[source]) {
		// TODO: Get rid of eval by moving refreshData method into common and parameterizing source
		eval(source).refreshData({ days: req.query.days || common.defaultDays });
		res.end();
	}
	else {
		res.status(404).send('Not found');
	}
});

const csvHeader = action => ({
	"Content-Disposition": action === 'download' ? 'attachment' : 'inline',
	"Content-Type": `text/${action === 'download' ? 'csv' : 'plain'}`
});

async function logCacheStatus() {
	const cacheLength = await api.cache.length();
	eventEmitter.emit('logging', `[${utils.getDate()}] Cached ${cacheLength} requests to external APIs.\n`);
}

app.get('/api/all-:id.csv', async (req, res) => {
	let urlParts = req.params.id.split('.')[0].split('-'); // withContacts or withoutContacts

	const action = req.query.action;
	res.set(csvHeader(action));

	// Return 'withContacts' or 'withoutContacts'
	const dataSet = utils.camelCaseArray(urlParts);

	try {
		// Combine records
		let results = [];
		for (const source of Object.keys(common.data.json)) {
			for (const record of common.data.json[source][dataSet]) {
				results.push(record);
			}
		}

		// Sort combined records by date descending
		results.sort((a, b) => (a.date < b.date) ? 1 : -1)

		const response = await converter.json2csvAsync(results, {
			emptyFieldValue: ''
		});
		res.send(response);
	}
	catch (err) {
		res.send(`${err.message}`);
	}
});

app.get('/api/:id', async (req, res) => {
	let urlParts = req.params.id.split('.')[0].split('-');

	const action = req.query.action;
	res.set(csvHeader(action));

	// Remove and return 'city311', 'cityDOB', 'inspections'...
	let source = urlParts.shift();
	if (source === 'DOB' || source === '311' || source === 'DOH') source =  'city' + source;
	
	// Return 'withContacts' or 'withoutContacts'
	const dataSet = utils.camelCaseArray(urlParts);
	if (common.data.csv[source]) {
		const data = common.getDataCSV(source, dataSet);
		res.send(data);
	}
	else {
		res.status(404).send('Not found');
	}
});

app.use(express.static('public'));

async function logSummary() {
	let numRecords = 0;
	let withContacts = 0;
	for (const source of Object.keys(common.data.json)) {
		for (const dataSet in common.data.json[source]) {
			for (const record of common.data.json[source][dataSet]) {
				numRecords++;
				if (dataSet === 'withContacts') {
					withContacts++;
				}
			}
		}
	}

	const pctOfTotal = Math.round(withContacts / numRecords * 100);
	eventEmitter.emit('logging', `[${utils.getDate()}] Updated sources. Total records: ${utils.addCommas(numRecords)}, with contacts: ${utils.addCommas(withContacts)} (${pctOfTotal}%)\n`);

	await logCacheStatus();
}

const port = parseInt(process.env.PORT, 10) || 3000;
http.listen(port, async () => {
	console.log(`> [${utils.getDate()}] App listening on port ${port}...`);
	await Promise.all([
		cityDOB.refreshData({ days: common.defaultDays }),
		city311.refreshData({ days: common.defaultDays }),
		inspections.refreshData({ days: common.defaultDays }),
		cityDOH.refreshData({ days: common.defaultDays })
	]);

	await logSummary();
});
