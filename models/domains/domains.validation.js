const DOMAIN_REGEX = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

const validateDomain = (domain) => {
  if (typeof domain !== "string") return false;
  const value = domain.trim().toLowerCase();
  if (!value || value.length > 253) return false;
  return DOMAIN_REGEX.test(value);
};

const validateDomains = (domains) => {
  if (Array.isArray(domains)) return domains.every(validateDomain);
  return validateDomain(domains);
};

module.exports = {
  validateDomain,
  validateDomains,
};
