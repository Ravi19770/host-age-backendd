const axios = require("axios");
const crypto = require("crypto");

const CVTPL_API_URL = (
    process.env.CVTPL_API_URL ||
    "https://admin.cvtpl.com/api/v1/partner"
).replace(/\/+$/, "");

const CVTPL_API_KEY = process.env.CVTPL_API_KEY;

if (!CVTPL_API_KEY) {
    console.warn(
        "CVTPL_API_KEY is not configured"
    );
}

const cvtplClient = axios.create({
    baseURL: CVTPL_API_URL,
    timeout: 30000,
    headers: {
        Authorization: `Bearer ${CVTPL_API_KEY || ""}`,
        Accept: "application/json",
        "Content-Type": "application/json",
    },
});

/**
 * Make a CVTPL API request.
 * Never log API keys or sensitive customer data.
 */
const request = async ({
    method,
    url,
    data,
    params,
    headers = {},
}) => {
    if (!CVTPL_API_KEY) {
        throw new Error(
            "CVTPL_API_KEY is not configured"
        );
    }

    try {
        const response = await cvtplClient.request({
            method,
            url,
            data,
            params,
            headers,
        });

        return {
            success: true,
            status: response.status,
            data: response.data,
        };
    } catch (error) {
        const status = error.response?.status;

        console.error("CVTPL API ERROR:", {
            method,
            url,
            status,
            message:
                error.response?.data?.message ||
                error.message,
        });

        const apiError = new Error(
            error.response?.data?.message ||
            "CVTPL API request failed"
        );

        apiError.status = status || 502;
        apiError.responseData = error.response?.data;

        throw apiError;
    }
};

/**
 * Create / provision a domain on CVTPL.
 *
 * requestId MUST be stable across retries for the same
 * domain provisioning operation.
 */
const createCvtplDomain = async ({
    userId,
    domain,
    customer,
    type = "addon",
    parentDomain = null,
    requestId,
}) => {
    if (!userId) {
        throw new Error("CVTPL userId is required");
    }

    if (
        typeof domain !== "string" ||
        !domain.trim()
    ) {
        throw new Error("CVTPL domain is required");
    }

    if (!["addon", "subdomain"].includes(type)) {
        throw new Error(
            "CVTPL type must be addon or subdomain"
        );
    }

    if (type === "subdomain" && !parentDomain) {
        throw new Error(
            "parentDomain is required for subdomain"
        );
    }

    if (
        typeof requestId !== "string" ||
        !requestId.trim()
    ) {
        throw new Error("CVTPL requestId is required");
    }

    const payload = {
        user_id: String(userId),
        domain: domain.trim().toLowerCase(),
        type,
        request_id: requestId.trim(),
    };

    if (customer) {
        payload.customer = {
            name:
                customer.name ||
                "Host-Age Customer",
            email:
                customer.email || null,
        };
    }

    if (type === "subdomain") {
        payload.parent_domain =
            parentDomain.trim().toLowerCase();
    }

    return request({
        method: "POST",
        url: "/domains",
        data: payload,
    });
};

/**
 * Get domains registered through CVTPL.
 */
const getCvtplDomains = async (userId) => {
    if (!userId) {
        throw new Error("CVTPL userId is required");
    }

    return request({
        method: "GET",
        url: "/domains",
        params: {
            user_id: String(userId),
        },
    });
};



const CVTPL_V2_API_URL =
  process.env.CVTPL_V2_API_URL ||
  "https://admin.cvtpl.com/api/v2/partner";



const cvtplV2Client = axios.create({
  baseURL: CVTPL_V2_API_URL.replace(/\/+$/, ""),
  timeout: 20000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// Only accept the documented CVTPL operations endpoint.
// Do not blindly request an arbitrary URL returned by an API.
function validateOperationUrl(statusUrl) {
  const url = new URL(statusUrl);

  if (
    url.protocol !== "https:" ||
    url.hostname !== "admin.cvtpl.com" ||
    url.port ||
    !url.pathname.startsWith("/api/v2/partner/operations/")
  ) {
    throw new Error("Invalid CVTPL operation status URL");
  }

  return url.toString();
}

async function submitDomainV2({
  userId,
  domain,
  type = "addon",
  parentDomain = null,
  requestId,
}) {
  if (!CVTPL_API_KEY) {
    throw new Error("CVTPL_API_KEY is not configured");
  }

  if (!userId || !domain || !requestId) {
    throw new Error("userId, domain and requestId are required");
  }

  if (!["addon", "subdomain"].includes(type)) {
    throw new Error("Invalid CVTPL domain type");
  }

  if (type === "subdomain" && !parentDomain) {
    throw new Error("parentDomain is required for subdomain");
  }

  const payload = {
    user_id: String(userId),
    request_id: requestId,
    domain: domain.trim().toLowerCase(),
    type,
  };

  if (type === "subdomain") {
    payload.parent_domain = parentDomain.trim().toLowerCase();
  }

  const response = await cvtplV2Client.post("/domains", payload, {
    headers: {
      Authorization: `Bearer ${CVTPL_API_KEY}`,
    },
    validateStatus: () => true,
  });

  if (response.status !== 202) {
    const error = new Error(
      response.data?.message || "CVTPL did not accept the operation"
    );
    error.status = response.status >= 400 ? response.status : 502;
    throw error;
  }

  const data = response.data;

  if (
    !data?.operation_id ||
    !data?.operation_token ||
    !data?.status_url
  ) {
    throw new Error(
      "CVTPL returned 202 without required operation details"
    );
  }

  return {
    operationId: String(data.operation_id),
    operationToken: String(data.operation_token),
    statusUrl: validateOperationUrl(data.status_url),
    providerStatus: data.status || "queued",
    pollAfterSeconds: Math.max(
      5,
      Math.min(60, Number(data.poll_after_seconds) || 10)
    ),
    providerResponse: data,
  };
}

async function getDomainOperationV2({
  statusUrl,
  operationToken,
}) {
  if (!CVTPL_API_KEY) {
    throw new Error("CVTPL_API_KEY is not configured");
  }

  const safeUrl = validateOperationUrl(statusUrl);

  if (!operationToken) {
    throw new Error("CVTPL operation token is missing");
  }

  const response = await cvtplV2Client.get(safeUrl, {
    headers: {
      Authorization: `Bearer ${CVTPL_API_KEY}`,
      "X-Operation-Token": operationToken,
    },
    // Avoid treating every HTTP response as a successful poll.
    validateStatus: () => true,
    timeout: 15000,
  });

  if (response.status < 200 || response.status >= 300) {
    const error = new Error(
      response.data?.message || "CVTPL status check failed"
    );
    error.status = response.status;
    throw error;
  }

  return response.data;
}

module.exports = {
  // Preserve your existing V1 exports here:
  cvtplClient,
  request,
  createCvtplDomain,
  getCvtplDomains,

  // V2 additions:
  submitDomainV2,
  getDomainOperationV2,
};
