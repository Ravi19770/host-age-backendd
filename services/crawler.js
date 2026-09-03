const axios = require("axios");
const dns = require("dns").promises;
const net = require("net");

const httpClient = axios.create({
  timeout: 10000,

  maxRedirects: 0,

  maxContentLength: 5 * 1024 * 1024,
  maxBodyLength: 5 * 1024 * 1024,

  validateStatus: (status) =>
    status >= 200 && status < 400,

  headers: {
    "User-Agent":
      process.env.CRAWLER_USER_AGENT ||
      "HostAgeBot/1.0",
  },
});

function normalizeDomain(domain) {
  if (!domain || typeof domain !== "string") {
    throw new Error("Invalid domain");
  }

  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map(Number);

  if (
    parts.length !== 4 ||
    parts.some((n) => Number.isNaN(n))
  ) {
    return false;
  }

  const [a, b] = parts;

  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function isPrivateIP(ip) {
  if (!net.isIP(ip)) {
    return true;
  }

  if (net.isIPv4(ip)) {
    return isPrivateIPv4(ip);
  }

  // IPv6 loopback / local ranges
  const normalized = ip.toLowerCase();

  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

async function resolveDomain(domain) {
  const addresses = await dns.lookup(domain, {
    all: true,
    verbatim: true,
  });

  if (!addresses.length) {
    throw new Error("Domain does not resolve");
  }

  for (const entry of addresses) {
    if (isPrivateIP(entry.address)) {
      throw new Error(
        "Domain resolves to a private/local IP"
      );
    }
  }

  return addresses.map(
    (entry) => entry.address
  );
}

async function crawlWebsite(domain) {
  const startedAt = Date.now();

  let cleanDomain;

  try {
    cleanDomain = normalizeDomain(domain);

    const ips = await resolveDomain(
      cleanDomain
    );

    const urls = [
      `https://${cleanDomain}`,
      `http://${cleanDomain}`,
    ];

    let lastError = null;

    for (const url of urls) {
      try {
        const response =
          await httpClient.get(url);

        // Manual redirect handling
        if (
          response.status >= 300 &&
          response.status < 400
        ) {
          const location =
            response.headers.location;

          if (!location) {
            throw new Error(
              "Redirect without location"
            );
          }

          const redirectUrl =
            new URL(location, url);

          const redirectHost =
            redirectUrl.hostname;

          const redirectIPs =
            await resolveDomain(
              redirectHost
            );

          if (
            redirectIPs.some(isPrivateIP)
          ) {
            throw new Error(
              "Redirect target is private/local"
            );
          }

          // Don't recursively follow arbitrary redirects here
          throw new Error(
            "Redirect target requires validation"
          );
        }

        const contentType =
          response.headers[
            "content-type"
          ] || "";

        if (
          !contentType
            .toLowerCase()
            .includes("text/html")
        ) {
          return {
            success: false,
            status: "invalid_content",
            html: "",
            error: "Website is not HTML",
            crawlTime:
              Date.now() - startedAt,
          };
        }

        return {
          success: true,
          status: "success",
          url,
          ip: ips[0],
          html: response.data,
          statusCode: response.status,
          contentType,
          crawlTime:
            Date.now() - startedAt,
        };
      } catch (error) {
        lastError = error;
      }
    }

    return {
      success: false,
      status: "failed",
      html: "",
      error:
        lastError?.message ||
        "Website crawl failed",
      crawlTime:
        Date.now() - startedAt,
    };
  } catch (error) {
    return {
      success: false,
      status: "dns_failed",
      html: "",
      error: error.message,
      crawlTime:
        Date.now() - startedAt,
    };
  }
}

module.exports = crawlWebsite;