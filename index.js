const fs = require("fs");
const xml2js = require("xml2js");
const xmlText = fs.readFileSync("dcat3.xml", "utf8");

xml2js.parseString(xmlText, { explicitArray: false }, (err, result) => {
  if (err) {
    console.error("Error parsing XML:", err);
    return;
  }

  const dataServices = [];

  function findDataServices(obj) {
    if (!obj || typeof obj !== "object") return;
    for (const key in obj) {
      if (key === "dcat:DataService") {
        let conformsToArr = [];
        const conformsToVal = obj[key]["dc:conformsTo"];
        if (Array.isArray(conformsToVal)) {
          conformsToArr = conformsToVal.map((e) => e["$"]["rdf:resource"]);
        } else if (
          conformsToVal &&
          conformsToVal["$"] &&
          conformsToVal["$"]["rdf:resource"]
        ) {
          conformsToArr = [conformsToVal["$"]["rdf:resource"]];
        }

        const ds = {
          publisher: obj[key]["dc:publisher"]["$"]["rdf:resource"],
          conformsTo: conformsToArr,
          endpointUrl: obj[key]["dcat:endpointURL"]["$"]["rdf:resource"],
          endpointDescription:
            obj[key]["dcat:endpointDescription"]["$"]["rdf:resource"],
        };

        if (obj[key]["dcat:contactPoint"]["vcard:Kind"]) {
          const vcard = obj[key]["dcat:contactPoint"]["vcard:Kind"];
          ds.vcard = vcard;
          ds.contact = {
            name: vcard["vcard:fn"].find((v) => v.$["xml:lang"] === "nl")._,
            email: vcard["vcard:hasEmail"]["$"]["rdf:resource"].replace("mailto:", ""),
            url: vcard["vcard:hasURL"],
          };
        }

        const hasOpenAPI = ds.conformsTo.some((url) => typeof url === "string" && url.includes("spec.openapis.org"));
        if (hasOpenAPI && ds.endpointDescription) {
          ds.assumedOasUrl = ds.endpointDescription;
        } else if (ds.endpointUrl) {
          ds.assumedOasUrl = `${ds.endpointUrl}/openapi.json`;
        } else {
          return;
        }

        dataServices.push(ds);
      } else if (typeof obj[key] === "object") {
        findDataServices(obj[key]);
      }
    }
  }

  findDataServices(result);

  const payloads = dataServices.map((ds) => ({
    organisationUri: ds.publisher,
    oasUrl: ds.assumedOasUrl,
    contact: ds.contact,
  }));

  console.log(payloads);
});
