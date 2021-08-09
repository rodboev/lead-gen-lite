'use strict';

const refreshLink = document.querySelector('a[href*="refresh"]');
const limit = document.querySelector('input#limit');

refreshLink.addEventListener('click', async (event) => {
	event.preventDefault();

	let output = document.querySelector('#output');
	if (!output) {
		output = document.createElement('div');
		output.id = 'output';
		document.body.appendChild(output);
	}
	
	const response = await fetch(refreshLink.href + '?limit=' + limit.value);
	const text = await response.text();
	output.innerText = text;
	output.scrollTop = output.scrollHeight;
});
