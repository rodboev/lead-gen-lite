const converter = require("json-2-csv");

const api = require("../lib/api");
const utils = require("../lib/utils");
const eventEmitter = require("../lib/events");

const defaultLimit = 50000;
const defaultDays = 5;
const permitsAPI = "/ipu4-2q9a.json";

let data = {
  json: {},
  csv: {},
};

function getDataCSV(source, dataSet) {
  return data.csv[source] ? data.csv[source][dataSet] : "App still loading...";
}

function getDataJSON(source, dataSet) {
  return data.json[source] ? data.json[source][dataSet] : "App still loading...";
}

// Prep records array
async function getRecords({ moduleName = "", baseURL = "", where = "", days, dateField, orderBy }) {
  // Log request
  // TODO: Use decorators for this
  let loggingString = `[${utils.getDate()}] (${moduleName}) Requesting `;
  days && (loggingString += `${days} days of `);
  loggingString += `${moduleName} records...\n`;
  eventEmitter.emit("logging", loggingString);

  // Pass on the request
  const records = await fetchData({
    moduleName,
    baseURL,
    where,
    days,
    dateField,
    orderBy,
    requestType: "records",
  });

  return records;
}

async function convertToCSV(results, moduleName = "") {
  if (!results) eventEmitter.emit("logging", `[ERROR] Nothing to convert to CSV.\n`);

  let totalCount = 0;
  for (const dataValue of Object.values(results)) {
    totalCount += dataValue.length;
  }

  const dataCsv = Object.create(null);
  for (const [dataSet, dataValue] of Object.entries(results)) {
    let filename = `${moduleName.toLowerCase()}-${utils.hyphenate(dataSet)}.csv`;
    let numLeads = Object.keys(dataValue).length;
    let pctOfTotal = Math.round((Object.keys(dataValue).length / totalCount) * 100);

    eventEmitter.emit(
      "logging",
      `[${utils.getDate()}] (${moduleName}) Pushing ${utils.addCommas(
        numLeads
      )} leads (${pctOfTotal}%) to ${filename}...\n`
    );

    dataCsv[dataSet] = await converter.json2csvAsync(dataValue, {
      emptyFieldValue: "",
    });
  }

  return dataCsv;
}

function getUniquePermits(permits, moduleName = "") {
  if (!permits) eventEmitter.emit("logging", `[ERROR] No records to process.\n`);

  const uniquePermits = [];
  const matchBy = ["bin__", "house__", "street_name", "block", "lot"];
  if (permits?.length > 0) {
    for (const permit of permits) {
      if (
        !uniquePermits.some(
          (uniquePermit) =>
            uniquePermit.bin__ === permit.bin__ &&
            uniquePermit.owner_s_house__ === permit.owner_s_house__ &&
            uniquePermit.owner_s_house_street_name === permit.owner_s_house_street_name
        )
      ) {
        // TODO: Parse date and push only if date is newest
        uniquePermits.push(permit);
      }
    }
  }

  eventEmitter.emit(
    "logging",
    `[${utils.getDate()}] (${moduleName}) Filtering ${utils.addCommas(
      permits?.length
    )} permits down to ${uniquePermits.length} uniques...\n`
  );

  return uniquePermits;
}

async function fetchData({
  moduleName = "",
  baseURL,
  where = "",
  days,
  dateField,
  orderBy,
  requestType = "request",
}) {
  // Add number of days to where (whereString)
  if (where || days) {
    const dateString = days ? `${dateField}>='${utils.todayMinus(days)}'` : "";
    where = [where, dateString].filter(Boolean).join(" AND ");
  }

  // Construct request
  const queryParams = {
    $where: where,
    $order: `${orderBy} DESC`,
    $limit: defaultLimit,
  };
  const queryString = api.getUri({ url: baseURL, params: queryParams });
  console.log(utils.truncate(`> Requesting ${moduleName} ${requestType}: ${queryString}`, 256));

  // Get data
  let records;
  try {
    const recordsReq = await api.get(queryString);
    records = recordsReq.data;
    // eventEmitter.emit('logging', `[${utils.getDate()}] (${moduleName}) Got ${utils.addCommas(records.length)} ${requestType} from ${moduleName}.\n`);
  } catch (err) {
    eventEmitter.emit(
      "logging",
      `[${utils.getDate()}] (${moduleName}) ${requestType.toUpperCase()} ERROR: ${err.message}\n`
    );
  }

  return records;
}

function getPermitFields(permit) {
  const newEntry = Object.create(null);

  if (permit) {
    newEntry.company = permit.owner_s_business_name;
    if (
      newEntry.company &&
      (newEntry.company.toUpperCase() === "NA" || newEntry.company.toUpperCase() === "N/A")
    ) {
      newEntry.company = "";
    }
    newEntry.first_name = permit.owner_s_first_name ? permit.owner_s_first_name.toUpperCase() : "";
    newEntry.last_name = permit.owner_s_last_name ? permit.owner_s_last_name.toUpperCase() : "";
    if (permit.owner_s_house__ && permit.owner_s_house_street_name) {
      newEntry.address = `${
        permit.owner_s_house__
      } ${permit.owner_s_house_street_name.toUpperCase()}`;
    }
    newEntry.city = permit.city ? permit.city.toUpperCase() : "";
    newEntry.state = permit.state ? permit.state.toUpperCase() : "";
    newEntry.zip = permit.owner_s_zip_code ? permit.owner_s_zip_code : "";
    if (permit.owner_s_phone__) {
      newEntry.phone = permit.owner_s_phone__;
    }
  }

  return newEntry;
}

function combineNotes({ records, moduleName }) {
  const originalLength = records.length;

  records = utils.removeDuplicates(records);

  for (let i = 0; i < records.length; i++) {
    let combined = 0;
    for (let j = records.length - 1; j > i; j--) {
      if (
        records[i].date === records[j].date &&
        // Make sure we're not matching empty addresses as equal
        records[i].address &&
        records[i].address === records[j].address
      ) {
        records[i].notes += ` AND ${records[j].notes}`;
        records.splice(j, 1);
        combined++;
      }
    }
    if (combined > 0) {
      records[i].notes = `(${combined + 1}) ${records[i].notes}`;
    }
  }

  eventEmitter.emit(
    "logging",
    `[${utils.getDate()}] (${moduleName}) Combined ${utils.addCommas(
      originalLength - records.length
    )} notes based on same date and address...\n`
  );

  return records;
}

module.exports = {
  defaultLimit,
  defaultDays,
  permitsAPI,
  data,
  getDataCSV,
  getRecords,
  convertToCSV,
  fetchData,
  getUniquePermits,
  getPermitFields,
  combineNotes,
};
