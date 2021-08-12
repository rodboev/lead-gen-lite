const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

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
	res.end();
});

app.get('/refresh/311', async (req, res) => {
	const queryLimit = req.query.limit;
	city311.refreshData(queryLimit);
	res.end();
});

const csvHeader = action => ({
	"Content-Disposition": action === 'download' ? 'attachment' : 'inline',
	"Content-Type": `text/${action === 'download' ? 'csv' : 'plain'}`
});

app.get('/api/dob-:id', function(req , res){
	const action = req.query.action;
	res.set(csvHeader(action));
	console.log(`Requested ${req.params.id}, returning dataCsv.${utils.removeExt(utils.unhyphenate(req.params.id))}`);
	res.send(cityDOB.dataCsv[utils.removeExt(utils.unhyphenate(req.params.id))]);
});

app.use(express.static('public'));

const port = parseInt(process.env.PORT, 10) || 3000;
http.listen(port, async () => {
	console.log(`[${utils.getDate()}] App listening on port ${port}...`);
	await cityDOB.refreshData();
	await city311.refreshData();
});
