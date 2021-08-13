'use strict';

let output = document.querySelector('#output');
socket.on('log_message', function (msg) {
	if (!output) {
		output = document.createElement('div');
		output.id = 'output';
		document.body.appendChild(output);
	}

	output.innerText += msg;
	output.scrollTop = output.scrollHeight;
});

const refreshDOB = document.querySelector('.refresh-dob .button');
const refresh311 = document.querySelector('.refresh-311 .button');
const refreshInspections = document.querySelector('.refresh-inspections .button');
const limitDOB = document.querySelector('.refresh-dob .limit');
const limit311 = document.querySelector('.refresh-311 .limit');
const limitInspections = document.querySelector('.refresh-inspections .limit');
const daysDOB = document.querySelector('.refresh-dob .days');
const days311 = document.querySelector('.refresh-311 .days');
const daysInspections = document.querySelector('.refresh-inspections .days');

refreshDOB.addEventListener('click', (event) => {
	event.preventDefault();
	let limit = limitDOB && limitDOB.value;
	let days = daysDOB && daysDOB.value;
	const params = Object.assign({},
		days && {days},
		limit && {limit}
	);
	fetch(refreshDOB.href + '?' + new URLSearchParams(params).toString());
});

refresh311.addEventListener('click', (event) => {
	event.preventDefault();
	let limit = limit311 && limit311.value;
	let days = days311 && days311.value;
	const params = Object.assign({},
		days && {days},
		limit && {limit}
	);
	fetch(refresh311.href + '?' + new URLSearchParams(params).toString());
});

refreshInspections.addEventListener('click', (event) => {
	event.preventDefault();
	let limit = limitInspections && limitInspections.value;
	let days = daysInspections && daysInspections.value;
	const params = Object.assign({},
		days && {days},
		limit && {limit}
	);
	fetch(refreshInspections.href + '?' + new URLSearchParams(params).toString());
});