'use strict';

const refreshLink = document.querySelector('a[href*="refresh"]');
const limit = document.querySelector('input#limit');
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

refreshLink.addEventListener('click', (event) => {
	event.preventDefault();
	fetch(refreshLink.href + '?limit=' + limit.value);
});
