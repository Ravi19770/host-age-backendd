const axios = require("axios");

const CVTPL_API_URL =
    process.env.CVTPL_API_URL ||
    "https://admin.cvtpl.com/api/v1/partner";

const CVTPL_API_KEY =
    process.env.CVTPL_API_KEY;

if (!CVTPL_API_KEY) {
    console.warn(
        "⚠️ CVTPL_API_KEY is not configured"
    );
}

const cvtplClient = axios.create({
    baseURL: CVTPL_API_URL,
    timeout: 30000,

    headers: {
        Authorization: `Bearer ${CVTPL_API_KEY}`,
        Accept: "application/json",
    },
});

/**
 * Make a CVTPL API request.
 *
 * IMPORTANT:
 * - Never log Authorization header.
 * - Never log mailbox passwords.
 * - POST requests must use a persistent request_id.
 */
const request = async ({
    method,
    url,
    data,
    params,
    headers = {},
}) => {
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
            headers: response.headers,
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

        throw error;
    }
};

/**
 * Create / provision a domain on CVTPL.
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

    if (!domain) {
        throw new Error("CVTPL domain is required");
    }

    if (!requestId) {
        throw new Error("CVTPL requestId is required");
    }

    const payload = {
        user_id: String(userId),
        domain,
        type,
        request_id: requestId,
    };

    if (customer) {
        payload.customer = {
            name:
                customer.name ||
                "Host-Age Customer",

            email:
                customer.email ||
                null,
        };
    }

    if (
        type === "subdomain" &&
        parentDomain
    ) {
        payload.parent_domain =
            parentDomain;
    }

    return request({
        method: "POST",
        url: "/domains",
        data: payload,
    });
};

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


module.exports = {
    cvtplClient,
    request,
    createCvtplDomain,
      getCvtplDomains,
};