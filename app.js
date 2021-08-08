var axios = require('axios');

(async () => {
	const violationsURL = "https://data.cityofnewyork.us/resource/mkgf-zjhb.json?$select=distinct%20violationid,inspectiondate,novdescription,bin&$order=violationid%20DESC&$limit=50";
	const violationsReq = await axios.get(violationsURL);
	const violations = violationsReq.data;

	console.log(`Requesting violations from URL:\n${violationsURL}\n`);

	let binSet = new Set();

	for (let i in violations) {
		binSet.add(violations[i].bin);
	}

	const binsToRequest = `(%27${Array.from(binSet).join("%27,%27")}%27)`;
	const permitsURL = "https://data.cityofnewyork.us/resource/ipu4-2q9a.json?$select=bin__,filing_date,owner_s_business_name,owner_s_first_name,owner_s_last_name,owner_s_house__,owner_s_house_street_name,city,state,owner_s_zip_code,owner_s_phone__&$where=bin__%20in" + binsToRequest;

	console.log(`Requesting permits for BINs ${Array.from(binSet)} using URL:\n${permitsURL}\n`);

	const permitsReq = await axios.get(permitsURL);
	const permits = permitsReq.data;

	let violationsArr = [];
	let obj;
	let lastViolationId;

	const formatDate = dateStr => new Date(dateStr).toISOString().substring(0,10);
	// const cleanString = str => str.replace(/[^ -~]+/g, ''); // remove non-printable
	const trimDescription = str => str.replace(/.+CONSISTING OF /g, '')
		.replace(/IN THE ENTIRE APARTMENT LOCATED AT /g, '')
		.replace(/, \d+?.. STORY, .+/g, '');

	for (let i in violations) {
		obj = {};
	  
		for (let j in permits) {
			if (violations[i].bin == permits[j].bin__) {
				obj.violation_id = violations[i].violationid;
				obj.violation = trimDescription(violations[i].novdescription);
				obj.inspection_date = formatDate(violations[i].inspectiondate);
				obj.bin = violations[i].bin;

				if (obj.violation_id !== lastViolationId) {
					obj.permit_date = formatDate(permits[j].filing_date);
					obj.company = permits[j].owner_s_business_name;
					obj.first_name = permits[j].owner_s_first_name;
					obj.last_name = permits[j].owner_s_last_name;
					obj.address = `${permits[j].owner_s_house__} ${permits[j].owner_s_house_street_name}`;
					obj.city = permits[j].city;
					obj.state = permits[j].state;
					obj.zip = permits[j].owner_s_zip_code;
					obj.phone = permits[j].owner_s_phone__;

					violationsArr.push(obj);
					lastViolationId = obj.violation_id;
				}
			}
		}
	}
	
	console.log(violationsArr);

})();
