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

async function resolveSafeDomain(domain) {
  const records = await dns.lookup(domain, {
    all: true,
    verbatim: true,
  });

  if (!records.length) {
    throw new Error(
      "Domain does not resolve"
    );
  }

  for (const record of records) {
    if (isPrivateIP(record.address)) {
      throw new Error(
        "Private IP is not allowed"
      );
    }
  }

  return records.map(
    (record) => record.address
  );
}

function detectFromHTML(html) {
  const result = {
    cms: null,
    framework: null,
    frontend: null,
    backend: null,
    server: null,
  };

  const lowerHTML =
    html.toLowerCase();

  // =========================
  // WordPress
  // =========================

  if (
    lowerHTML.includes("/wp-content/") ||
    lowerHTML.includes("/wp-includes/") ||
    lowerHTML.includes(
      'name="generator" content="wordpress'
    )
  ) {
    result.cms = "WordPress";
  }

  // =========================
  // Next.js
  // =========================

  if (
    html.includes("__NEXT_DATA__") ||
    lowerHTML.includes("/_next/static/")
  ) {
    result.framework = "Next.js";
  }

  // =========================
  // React
  // =========================

  if (
    lowerHTML.includes("react-dom") ||
    lowerHTML.includes("data-reactroot") ||
    lowerHTML.includes("data-reactid") ||
    html.includes("__NEXT_DATA__")
  ) {
    result.frontend = "React";
  }

  // =========================
  // Vue
  // =========================

  if (
    lowerHTML.includes("vue") ||
    lowerHTML.includes("data-v-")
  ) {
    if (!result.frontend) {
      result.frontend = "Vue";
    }
  }

  // =========================
  // Angular
  // =========================

  if (
    lowerHTML.includes("ng-version") ||
    lowerHTML.includes("ng-app")
  ) {
    if (!result.frontend) {
      result.frontend = "Angular";
    }
  }

  return result;
}

async function detectTechnology(domain) {
  try {
    if (
      !domain ||
      typeof domain !== "string"
    ) {
      return {
        cms: null,
        framework: null,
        frontend: null,
        backend: null,
        server: null,
      };
    }

    const cleanDomain = domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+$/, "");

    // SSRF protection
    await resolveSafeDomain(
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
            cms: null,
            framework: null,
            frontend: null,
            backend: null,
            server:
              response.headers.server ||
              null,
          };
        }

        return {
          ...detectFromHTML(
            response.data
          ),

          server:
            response.headers.server ||
            null,
        };
      } catch (error) {
        lastError = error;
      }
    }

    console.warn(
      "Technology detection failed:",
      lastError?.message
    );

    return {
      cms: null,
      framework: null,
      frontend: null,
      backend: null,
      server: null,
    };
  } catch (error) {
    console.warn(
      "Technology detector error:",
      error.message
    );

    return {
      cms: null,
      framework: null,
      frontend: null,
      backend: null,
      server: null,
    };
  }
}

module.exports = detectTechnology;