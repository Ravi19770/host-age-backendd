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

module.exports = {
    cvtplClient,
    request,
    createCvtplDomain,
    getCvtplDomains,
};

