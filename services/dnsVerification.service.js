
const dns = require("node:dns").promises;
const Domain = require("../models/domains/domains.model");

const SUPPORTED_TYPES = new Set(["A", "AAAA", "CNAME", "TXT", "MX"]);

function normalizeValue(value) {
  return String(value ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

function normalizeRecords(config) {
  if (!config) return [];

  if (Array.isArray(config)) {
    return config.map((record) => ({
      type: String(record.type || "").toUpperCase(),
      name: record.name || record.host || record.hostname || "@",
      value:
        record.value ??
        record.target ??
        record.content ??
        record.data,
    }));
  }

  if (Array.isArray(config.records)) {
    return normalizeRecords(config.records);
  }

  return Object.entries(config)
    .filter(([key]) => SUPPORTED_TYPES.has(key.toUpperCase()))
    .flatMap(([type, values]) =>
      (Array.isArray(values) ? values : [values]).map((item) => {
        if (item && typeof item === "object") {
          return {
            type: type.toUpperCase(),
            name: item.name || item.host || "@",
            value:
              item.value ??
              item.target ??
              item.content ??
              item.data,
          };
        }

        return {
          type: type.toUpperCase(),
          name: "@",
          value: item,
        };
      })
    );
}

function getRecordName(name, domain) {
  const host = String(name || "@").trim().toLowerCase();

  if (!host || host === "@") return domain;
  if (host === domain || host.endsWith(`.${domain}`)) {
    return host.replace(/\.$/, "");
  }

  return `${host.replace(/\.$/, "")}.${domain}`;
}

async function lookupRecord(type, hostname) {
  try {
    switch (type) {
      case "A":
        return (await dns.resolve4(hostname)).map(normalizeValue);

      case "AAAA":
        return (await dns.resolve6(hostname)).map(normalizeValue);

      case "CNAME":
        return (await dns.resolveCname(hostname)).map(normalizeValue);

      case "TXT":
        return (await dns.resolveTxt(hostname)).map((parts) =>
          parts.join("")
        );

      case "MX":
        return (await dns.resolveMx(hostname)).map((record) =>
          normalizeValue(record.exchange)
        );

      default:
        return [];
    }
  } catch (error) {
    if (
      ["ENODATA", "ENOTFOUND", "ESERVFAIL", "ETIMEOUT", "ECONNREFUSED"]
        .includes(error.code)
    ) {
      return [];
    }

    throw error;
  }
}

async function verifyDomainDns(domainRecord) {
  const domain = domainRecord.domain.toLowerCase();
  const expected = normalizeRecords(domainRecord.cvtpl?.dns);

  const validRecords = expected.filter(
    (record) =>
      SUPPORTED_TYPES.has(record.type) &&
      record.value !== undefined &&
      record.value !== null &&
      String(record.value).trim() !== ""
  );

  if (!validRecords.length || validRecords.length !== expected.length) {
    return {
      verified: false,
      status: "configuration_unavailable",
      message: "Expected DNS records are missing or unsupported.",
      results: [],
    };
  }

  const results = [];

  for (const record of validRecords) {
    const hostname = getRecordName(record.name, domain);
    const expectedValue = normalizeValue(record.value);

    try {
      const actualValues = await lookupRecord(record.type, hostname);
      const matched = actualValues.some(
        (actual) => normalizeValue(actual) === expectedValue
      );

      results.push({
        type: record.type,
        name: hostname,
        expected: String(record.value),
        actual: actualValues,
        matched,
      });
    } catch (error) {
      results.push({
        type: record.type,
        name: hostname,
        expected: String(record.value),
        actual: [],
        matched: false,
        error: error.code || "DNS_LOOKUP_ERROR",
      });
    }
  }

  const verified =
    results.length > 0 && results.every((result) => result.matched);

  const previousStatus =
    domainRecord.cvtpl?.dnsVerification?.status;

  const updatedCvtpl = {
    ...(domainRecord.cvtpl || {}),
    dnsVerification: {
      status: verified ? "verified" : "pending",
      checkedAt: new Date().toISOString(),
      results,
    },
  };

  const update = { cvtpl: updatedCvtpl };

  if (domainRecord.status !== "rejected") {
    update.verified = verified;
    update.status = verified ? "verified" : "pending";
  }

  await domainRecord.update(update);

  return {
    success: true,
    verified,
    status: verified ? "verified" : "pending",
    changed: previousStatus !== (verified ? "verified" : "pending"),
    domain,
    results,
  };
}

async function recheckPendingDomains() {
  const domains = await Domain.findAll({
    where: { status: "pending" },
  });

  for (const domainRecord of domains) {
    if (!domainRecord.cvtpl?.dns) continue;

    try {
      const result = await verifyDomainDns(domainRecord);
      console.log(
        `[DNS RECHECK] ${domainRecord.domain}: ${result.status}`
      );
    } catch (error) {
      console.error(
        `[DNS RECHECK] ${domainRecord.domain}:`,
        error.message
      );
    }
  }
}

module.exports = {
  verifyDomainDns,
  recheckPendingDomains,
};
