const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const api = require('./lib/api');
const utils = require('./lib/utils');
const eventEmitter = require('./lib/events');
const cityDOB = require('./sources/cityDOB');
const city311 = require('./sources/city311');

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
app.get('/refresh/dob', async (req, res) => {
	const queryLimit = req.query.limit;
	cityDOB.refreshData(queryLimit);
	await emitCacheStatus();
	res.end();
});

app.get('/refresh/311', async (req, res) => {
	const queryLimit = req.query.limit;
	city311.refreshData(queryLimit);
	await emitCacheStatus();
	res.end();
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

	let dataSet = urlParts.shift().toUpperCase(); // return '311' or 'DOB'
	if (dataSet === 'DOB' || dataSet === '311') {
		dataSet = 'city' + dataSet;
	}

	const dataType = utils.camelCaseArray(urlParts); // return 'withContacts' or 'withoutContacts'
	const action = req.query.action;
	res.set(csvHeader(action)); // 'view' or 'download'

	const data = eval(dataSet).getData(dataType); // e.g. city311.getData('withContacts')
	res.send(data);
});

app.use(express.static('public'));

const port = parseInt(process.env.PORT, 10) || 3000;
http.listen(port, async () => {
	console.log(`[${utils.getDate()}] App listening on port ${port}...`);
	cityDOB.refreshData();
	city311.refreshData();
});
