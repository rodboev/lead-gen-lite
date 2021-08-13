const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const api = require('./lib/api');
const utils = require('./lib/utils');
const eventEmitter = require('./lib/events');
const cityDOB = require('./sources/cityDOB');
const city311 = require('./sources/city311');
const inspections = require('./sources/inspections');

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
	let dataSet = req.params.id;

	// Return 'city311' or 'cityDOB'
	if (dataSet === 'dob') dataSet = dataSet.toUpperCase()
	if (dataSet === 'DOB' || dataSet === '311') dataSet =  'city' + dataSet;

	const dataSetObj = eval(dataSet);
	if (dataSetObj) {
		eval(dataSet).refreshData(req.query.limit, req.query.days);
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

app.get('/api/:id', async function(req , res) {
	let urlParts = req.params.id.split('.')[0].split('-');

	// Return 'city311' or 'cityDOB'
	let dataSet = urlParts.shift();
	if (dataSet === 'dob') dataSet = dataSet.toUpperCase()
	if (dataSet === 'DOB' || dataSet === '311') dataSet =  'city' + dataSet;

	const action = req.query.action;
	res.set(csvHeader(action));

	const dataType = utils.camelCaseArray(urlParts); // 'withContacts' or 'withoutContacts'
	const dataSetObj = eval(dataSet);
	if (dataSetObj) {
		const data = eval(dataSet).getData(dataType); // city311.getData('withContacts')
		res.send(data);
	}
	else {
		res.status(404).send('Not found');
	}
});

app.use(express.static('public'));

const port = parseInt(process.env.PORT, 10) || 3000;
http.listen(port, async () => {
	console.log(`[${utils.getDate()}] App listening on port ${port}...`);
	cityDOB.refreshData();
	city311.refreshData();
	inspections.refreshData();
});
