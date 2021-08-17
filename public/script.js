'use strict';

socket.on('log_message', function (msg) {
	let output = document.querySelector('#output');
	if (!output) {
		output = document.createElement('div');
		output.id = 'output';
		document.body.appendChild(output);
	}

	output.innerText += msg;
	output.scrollTop = output.scrollHeight;
});

const days = document.querySelector('.days').value;
document.querySelectorAll('.button').forEach(button => {
	button.addEventListener('click', event => {
		const el = event.target;
		event.preventDefault();
		fetch(el.href + '?' + new URLSearchParams({ days }).toString());
	})
})  
