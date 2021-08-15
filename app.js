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
const common = require('./sources/common');

// Real-time logging
const history = [];
eventEmitter.on('logging', function (message) {
	history.push(message);
	io.emit('log_message', message);
});
io.on('connection', (socket) => {
	socket.emit('logging', history);
	io.emit('log_message', history.join(''));
});

// App routes to handle requests
app.get('/refresh/:id', async (req, res) => {
	let source = req.params.id;

	// Return 'city311', 'cityDOB', 'inspections'...
	if (source === 'dob') source = source.toUpperCase()
	if (source === 'DOB' || source === '311') source =  'city' + source;

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

async function emitCacheStatus() {
	const cacheLength = await api.cache.length();
	eventEmitter.emit('logging', `[${utils.getDate()}] Sending request (${cacheLength} requests cached)...\n`);
}

app.get('/api/all-:id.csv', async function(req , res) {
	let urlParts = req.params.id.split('.')[0].split('-');

	const action = req.query.action;
	res.set(csvHeader(action));

	// Return 'withContacts' or 'withoutContacts'
	const dataSet = utils.camelCaseArray(urlParts);

	try {
		let results = [];
		for (const source of Object.keys(common.data.json)) {
			for (record of common.data.json[source][dataSet]) {
				results.push(record);
			}
		}

		// const result = await common.convertToCSV(results, 'all');
		const response = await converter.json2csvAsync(results, {
			emptyFieldValue: ''
		});
		res.send(response);
	}
	catch (err) {
		res.send(`${err.message}\nApp probably still loading...`);
	}
});

app.get('/api/:id', async function(req , res) {
	let urlParts = req.params.id.split('.')[0].split('-');

	const action = req.query.action;
	res.set(csvHeader(action));

	// Remove and return 'city311', 'cityDOB', 'inspections'...
	let source = urlParts.shift();
	if (source === 'dob') source = source.toUpperCase()
	if (source === 'DOB' || source === '311') source =  'city' + source;
	
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

const port = parseInt(process.env.PORT, 10) || 3000;
http.listen(port, async () => {
	console.log(`> [${utils.getDate()}] App listening on port ${port}...`);
	await Promise.all([
		cityDOB.refreshData({ days: common.defaultDays }),
		city311.refreshData({ days: common.defaultDays }),
		inspections.refreshData({ days: common.defaultDays })
	]);
});
