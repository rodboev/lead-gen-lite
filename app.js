// from https://data.cityofnewyork.us/resource/mkgf-zjhb.json?$select=distinct%20violationid,inspectiondate,novdescription,bin&$order=violationid%20DESC
var violations = [
	{"violationid":"14485735","inspectiondate":"2021-08-06T00:00:00.000","novdescription":"HMC ADM CODE: ï¿½ 27-2017.4 ABATE THE INFESTATION CONSISTING OF ROACHES IN THE ENTIRE APARTMENT LOCATED AT APT A1, 1st STORY, 1st APARTMENT FROM WEST AT NORTH","bin":"4029850"}
	,{"violationid":"14485710","inspectiondate":"2021-08-06T00:00:00.000","novdescription":"HMC ADM CODE: ï¿½ 27-2017.4 ABATE THE INFESTATION CONSISTING OF MICE LOCATED AT APT 2, 2nd STORY, 1st APARTMENT FROM SOUTH AT WEST","bin":"2069742"}
	,{"violationid":"14485676","inspectiondate":"2021-08-06T00:00:00.000","novdescription":"HMC ADM CODE: ï¿½ 27-2017.4 ABATE THE INFESTATION CONSISTING OF MICE IN THE ENTIRE APARTMENT LOCATED AT APT 5C, 5th STORY, 1st APARTMENT FROM EAST AT SOUTH","bin":"2063241"}
	,{"violationid":"14485674","inspectiondate":"2021-08-06T00:00:00.000","novdescription":"HMC ADM CODE: ï¿½ 27-2017.4 ABATE THE INFESTATION CONSISTING OF ROACHES IN THE ENTIRE APARTMENT LOCATED AT APT 5C, 5th STORY, 1st APARTMENT FROM EAST AT SOUTH","bin":"2063241"}
	,{"violationid":"14485667","inspectiondate":"2021-08-06T00:00:00.000","novdescription":"HMC ADM CODE: ï¿½ 27-2017.4 ABATE THE INFESTATION CONSISTING OF ROACHES IN THE ENTIRE APARTMENT LOCATED AT APT 3I, 5th STORY, 1st APARTMENT FROM SOUTH AT WEST","bin":"2013917"}
	,{"violationid":"14485623","inspectiondate":"2021-08-06T00:00:00.000","novdescription":"HMC ADM CODE: ï¿½ 27-2017.4 ABATE THE INFESTATION CONSISTING OF ROACHES IN THE ENTIRE APARTMENT LOCATED AT APT 3F, 4th STORY, 1st APARTMENT FROM NORTH AT EAST","bin":"2009060"}
];

// from https://data.cityofnewyork.us/resource/ipu4-2q9a.json?$select=bin__,filing_date,owner_s_business_name,owner_s_first_name,owner_s_last_name,owner_s_house__,owner_s_house_street_name,city,state,owner_s_zip_code,owner_s_phone__&$where=bin__%20in('4029850','2069742','2063241','2063241','2013917','2009060')&$order=filing_date%20DESC
var permits = [
	{"bin__":"2013917","filing_date":"2019-06-24 ","owner_s_business_name":"SHAH GROUP ENTERPRISES INC","owner_s_first_name":"MANJINDER","owner_s_last_name":"SINGH","owner_s_house__":"128-24","owner_s_house_street_name":"140TH STREET","city":"JAMAICA","state":"NY","owner_s_zip_code":"11436","owner_s_phone__":"7187389500"}
	,{"bin__":"2013917","filing_date":"2018-01-30 ","owner_s_business_name":"BRONX JUICE BITES & MORE","owner_s_first_name":"SEMIRAMIS","owner_s_last_name":"PEGUERO","owner_s_house__":"115A","owner_s_house_street_name":"EAST 184 STREET","city":"BRONX","state":"NY","owner_s_zip_code":"10468","owner_s_phone__":"6464886545"}
	,{"bin__":"2013917","filing_date":"2017-10-19 ","owner_s_business_name":"WINDWARD RE","owner_s_first_name":"STEVE","owner_s_last_name":"HACKEL","owner_s_house__":"475","owner_s_house_street_name":"PARK AVENUE SOUTH","city":"MANHATTAN","state":"NY","owner_s_zip_code":"10031","owner_s_phone__":"6462898688"}
	,{"bin__":"2013917","filing_date":"2017-10-19 ","owner_s_business_name":"WINDWARD RE","owner_s_first_name":"STEVE","owner_s_last_name":"HACKEL","owner_s_house__":"475","owner_s_house_street_name":"PARK AVENUE SOUTH","city":"MANHATTAN","state":"NY","owner_s_zip_code":"10031","owner_s_phone__":"6462898688"}
	,{"bin__":"2013917","filing_date":"2017-10-19 ","owner_s_business_name":"WINDWARD RE","owner_s_first_name":"STEVE","owner_s_last_name":"HACKEL","owner_s_house__":"475","owner_s_house_street_name":"PARK AVENUE SOUTH","city":"MANHATTAN","state":"NY","owner_s_zip_code":"10031","owner_s_phone__":"6462898688"}
	,{"bin__":"2013917","filing_date":"2017-05-26 ","owner_s_business_name":"S & D DELI PLUS GROCERY CORP","owner_s_first_name":"WILFREDO","owner_s_last_name":"ALMONZE","owner_s_house__":"115","owner_s_house_street_name":"EAST 184 STREET","city":"BRONX","state":"NY","owner_s_zip_code":"10468","owner_s_phone__":"6462594079"}
	,{"bin__":"2013917","filing_date":"2016-11-02 ","owner_s_business_name":"S & D DELI PLUS GROCERY CORP","owner_s_first_name":"WILFREDO","owner_s_last_name":"ALMONZE","owner_s_house__":"115","owner_s_house_street_name":"EAST 184 STREET","city":"BRONX","state":"NY","owner_s_zip_code":"10468","owner_s_phone__":"6462594079"}
	,{"bin__":"2009060","filing_date":"2016-06-20 ","owner_s_business_name":"181 W. TREMONT ASSOC. LLC","owner_s_first_name":"BOB","owner_s_last_name":"HERSKOWITZ","owner_s_house__":"P.O.","owner_s_house_street_name":"BOX 198","city":"BRONX","state":"NY","owner_s_zip_code":"10461","owner_s_phone__":"7188929412"}
	,{"bin__":"2013917","filing_date":"2015-01-15 ","owner_s_business_name":"S & D DELI","owner_s_first_name":"WILFREDO","owner_s_last_name":"ALMONZE","owner_s_house__":"115","owner_s_house_street_name":"EAST 184 STREET","city":"BRONX","state":"NY","owner_s_zip_code":"10468","owner_s_phone__":"7183679001"}
	,{"bin__":"2069742","filing_date":"2014-09-26 ","owner_s_business_name":"N/A","owner_s_first_name":"PREMNAUTH","owner_s_last_name":"SURAJNARINE","owner_s_house__":"4373","owner_s_house_street_name":"MATILDA AVENUE","city":"BRONX","state":"NY","owner_s_zip_code":"10466","owner_s_phone__":"6465287147"}
	,{"bin__":"2013917","filing_date":"2013-03-01 ","owner_s_business_name":"MASTER FIRE SYSTEMS INC","owner_s_first_name":"PETER","owner_s_last_name":"MARTINEZ","owner_s_house__":"1776","owner_s_house_street_name":"E TREMONT AVENUE","city":"BRONX","state":"NY","owner_s_zip_code":"10460","owner_s_phone__":"7188286424"}
	,{"bin__":"4029850","filing_date":"2009-03-06 ","owner_s_business_name":"ROBERT MORRIS REALTY CORP.","owner_s_first_name":"STEPHAN","owner_s_last_name":"GOLLER","owner_s_house__":"79-06","owner_s_house_street_name":"37 AVE.","city":"JACKSON HTS.","state":"NY","owner_s_zip_code":"11372","owner_s_phone__":"7184570033"}
	,{"bin__":"2063241","filing_date":"2007-09-11 ","owner_s_business_name":"N/A","owner_s_first_name":"AFZAL","owner_s_last_name":"GULBAHAR","owner_s_house__":"636","owner_s_house_street_name":"EAST 231 STREET","city":"BRONX","state":"NY","owner_s_zip_code":"10466","owner_s_phone__":"7186843518"}
	,{"bin__":"2063241","filing_date":"2007-07-25 ","owner_s_business_name":"N/A","owner_s_first_name":"MANJIT","owner_s_last_name":"SINGH","owner_s_house__":"118-14","owner_s_house_street_name":"ATLANTIC AVE","city":"RICHMOND HILL","state":"NY","owner_s_zip_code":"11419","owner_s_phone__":"9177015598"}
	,{"bin__":"2013917","filing_date":"2004-10-27 ","owner_s_business_name":"2377 CRESTON AVENUE L.L.C.","owner_s_first_name":"AKIJA","owner_s_last_name":"LAJQI","owner_s_house__":"P.O. BOX 151","owner_s_house_street_name":"2377 CRESTON AVENUE","city":"BRONX","state":"NY","owner_s_zip_code":"10461","owner_s_phone__":"7188284067"}
	,{"bin__":"4029850","filing_date":"1996-10-22 ","owner_s_business_name":"ROBERT MORRIS REALTY CORP.","owner_s_first_name":"STEPHAN","owner_s_last_name":"GOLLER","owner_s_house__":"79-06","owner_s_house_street_name":"37 AVE.","city":"JACKSON HTS.","state":"NY","owner_s_zip_code":"11372","owner_s_phone__":"7184570033"}
	,{"bin__":"4029850","filing_date":"1996-10-22 ","owner_s_business_name":"ROBERT MORRIS REALTY CORP.","owner_s_first_name":"STEPHAN","owner_s_last_name":"GOLLER","owner_s_house__":"79-06","owner_s_house_street_name":"37 AVE.","city":"JACKSON HTS.","state":"NY","owner_s_zip_code":"11372","owner_s_phone__":"7184570033"}
	,{"bin__":"2063241","filing_date":"1992-08-24 ","owner_s_business_name":"318 REALTY CO.","owner_s_first_name":"MORRIS","owner_s_last_name":"PODOLSKI","owner_s_house__":"3153","owner_s_house_street_name":"PERRY AV","city":"BX","state":"NY","owner_s_zip_code":"10467","owner_s_phone__":"2127999050"}
	,{"bin__":"2063241","filing_date":"1991-07-31 ","owner_s_business_name":"318 REALTY CO.","owner_s_first_name":"MORRIS","owner_s_last_name":"PODOLSKI","owner_s_house__":"3153","owner_s_house_street_name":"PERRY AV","city":"BX","state":"NY","owner_s_zip_code":"10467","owner_s_phone__":"2127999050"}
];

var arrayList = [];

for (var i in violations) {
	var obj = {
		violation: violations[i].novdescription,
		bin: violations[i].bin,
	};

	for (var j in permits) {
		if (violations[i].bin == permits[j].bin__) {
			obj.bin = permits[j].bin__;
			obj.filing_date = permits[j].filing_date,
			obj.owner_business = permits[j].owner_s_business_name,
			obj.owner_name = `${permits[j].owner_s_first_name} ${permits[j].owner_s_owners_last_name}`,
			obj.owner_address = `${permits[j].owner_s_house__} ${permits[j].owner_s_house_street_name}, ${permits[j].city}, ${permits[j].state}, ${permits[j].owner_s_zip_code}`,
			obj.owner_phone = permits[j].owner_s_phone__
		}
	}

	obj.bin = obj.bin || 'No BIN record';
	arrayList.push(obj);
}

console.log(arrayList);
