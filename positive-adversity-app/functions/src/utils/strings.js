function cleanString(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeEmail(value) {
  return cleanString(value, 120).toLowerCase();
}

function maskEmail(email) {
  const [name = "", domain = ""] = normalizeEmail(email).split("@");

  if (!name || !domain) return "";

  const visibleName =
    name.length <= 2 ? `${name[0] || ""}***` : `${name.slice(0, 2)}***`;
  const domainParts = domain.split(".");
  const domainName = domainParts[0] || "";
  const domainSuffix = domainParts.slice(1).join(".");
  const visibleDomain =
    domainName.length <= 1
      ? `${domainName}***`
      : `${domainName[0]}***`;

  return `${visibleName}@${visibleDomain}${domainSuffix ? `.${domainSuffix}` : ""}`;
}

module.exports = {
  cleanString,
  normalizeEmail,
  maskEmail,
};
