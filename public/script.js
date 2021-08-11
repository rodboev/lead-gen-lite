'use strict';

const refreshLink = document.querySelector('a[href*="refresh"]');
const limit = document.querySelector('input#limit');
const output = document.querySelector('#output');

socket.on('log_message', function (msg) {
	output.innerText += msg;
	output.scrollTop = output.scrollHeight;
});

refreshLink.addEventListener('click', (event) => {
	event.preventDefault();
	fetch(refreshLink.href + '?limit=' + limit.value);
});
