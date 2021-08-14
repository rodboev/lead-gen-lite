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

document.querySelectorAll('.button').forEach(button => {
	button.addEventListener('click', event => {
		const el = event.target;
		event.preventDefault();
		const daysInput = el.parentNode.querySelector('input');
		const days = daysInput && daysInput.value;
		const params = Object.assign({}, days && {days});
		fetch(el.href + '?' + new URLSearchParams(params).toString());
	})
})  
