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
	Promise.all(Object.keys(common.data.json).map(source => {
			eval(source).refreshData({days: req.query.days || common.defaultDays });
		})).then(async () => {
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

app.get('/api/all-:id', async (req, res) => {
	const urlParts = req.params.id.split('.');
	const set = urlParts[0].split('-');
	const dataSet = utils.camelCaseArray(set);
	const fileExt = urlParts[1];

	const action = req.query.action;
	res.set(csvHeader(action));

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

		if (fileExt === 'csv') {
			const response = await converter.json2csvAsync(results, {
				emptyFieldValue: ''
			});
			res.send(response);
		}
		else if (fileExt === 'json') {
			const response = results;
			res.send(response);
		}
		else {
			res.status(404).send('Not found');
		}
	}
	catch (err) {
		res.send(`${err.message}`);
	}
});

app.get('/api/:id', async (req, res) => {
	const urlParts = req.params.id.split('.');
	let sourceAndSet = urlParts[0].split('-');
	const fileExt = urlParts[1];

	const action = req.query.action;
	res.set(csvHeader(action));

	// Remove and return 'city311', 'cityDOB', 'inspections'...
	let source = sourceAndSet.shift();
	if (source === 'DOB' || source === '311' || source === 'DOH') source =  'city' + source;
	// Return 'withContacts' or 'withoutContacts'
	const dataSet = utils.camelCaseArray(sourceAndSet);

	// Server up CSV or JSON
	if (fileExt === 'csv' && common.data.csv[source]) {
		const data = common.getDataCSV(source, dataSet);
		res.send(data);
	}
	else if (fileExt === 'json' && common.data.json[source]) {
		const data = common.data.json[source][dataSet];
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
