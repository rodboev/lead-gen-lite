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

refreshDOB.addEventListener('click', (event) => {
	event.preventDefault();
	fetch(refreshDOB.href + '?limit=' + limitDOB.value);
});

refresh311.addEventListener('click', (event) => {
	event.preventDefault();
	fetch(refresh311.href + '?limit=' + limit311.value);
});

refreshInspections.addEventListener('click', (event) => {
	event.preventDefault();
	fetch(refreshInspections.href + '?limit=' + limitInspections.value);
});