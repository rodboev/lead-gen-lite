var axios = require('axios');

(async () => {
	const violationsURL = "https://data.cityofnewyork.us/resource/mkgf-zjhb.json?$select=violationid,inspectiondate,novdescription,bin&$order=violationid%20DESC&$limit=50";
	const violationsReq = await axios.get(violationsURL);
	const violations = violationsReq.data;

	let binSet = new Set();

	for (let i in violations) {
		binSet.add(violations[i].bin);
	}

	const binsToRequest = `('${Array.from(binSet).join("','")}')`;
	const permitsURL = "https://data.cityofnewyork.us/resource/ipu4-2q9a.json?$select=bin__,filing_date,owner_s_business_name,owner_s_first_name,owner_s_last_name,owner_s_house__,owner_s_house_street_name,city,state,owner_s_zip_code,owner_s_phone__&$where=bin__%20in" + binsToRequest;

	const permitsReq = await axios.get(permitsURL);
	const permits = permitsReq.data;

	let arrayList = [];

	for (let i in violations) {
		let obj = {};
	
		for (let j in permits) {
			if (violations[i].bin == permits[j].bin__) {
				obj.inspectiondate = violations[i].inspectiondate;
				obj.violation = violations[i].novdescription;
				obj.bin = violations[i].bin;

				obj.filed = permits[j].filing_date;
				obj.owner_business = permits[j].owner_s_business_name;
				obj.owner_name = `${permits[j].owner_s_first_name} ${permits[j].owner_s_last_name}`;
				obj.owner_address = `${permits[j].owner_s_house__} ${permits[j].owner_s_house_street_name}, ${permits[j].city}, ${permits[j].state}, ${permits[j].owner_s_zip_code}`;
				obj.owner_phone = permits[j].owner_s_phone__;

				arrayList.push(obj);
			}
		}
	}
	
	console.log(arrayList);

})();
