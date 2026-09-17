export const SERVICE_OPTIONS = [
  { value: "DCF", label: "DCF Mentoring Service" },
  { value: "Mashantucket", label: "Mashantucket Mentoring Service" },
  {
    value: "dcf_supervised_visitation",
    label: "DCF Supervised Visitation Service",
  },
  {
    value: "mashantucket_supervised_visitation",
    label: "Mashantucket Supervised Visitation Service",
  },
];

export const SERVICE_RATES = {
  DCF: {
    client: 25,
    internal: 45,
  },
  Mashantucket: {
    client: 25,
    internal: 50,
  },
  dcf_supervised_visitation: {
    client: 25,
    internal: 55,
  },
  mashantucket_supervised_visitation: {
    client: 25,
    internal: 55,
  },
};

export const MONTHLY_FEE_OPTIONS = [
  {
    value: "dcf_supervision",
    label: "Mentoring Service Fee",
    amount: 11.25,
    eligibleServiceTypes: ["DCF"],
  },
  {
    value: "dcf_supervised_visitation_fee",
    label: "Supervised Visitation Fee",
    amount: 13.75,
    eligibleServiceTypes: ["dcf_supervised_visitation"],
  },
];

export function getMonthlyFeeOption(feeType) {
  return (
    MONTHLY_FEE_OPTIONS.find((option) => option.value === feeType) || null
  );
}

export function getMonthlyFeeOptionsForService(serviceType) {
  return MONTHLY_FEE_OPTIONS.filter((option) =>
    option.eligibleServiceTypes.includes(serviceType),
  );
}

export const DONATE_URL =
  "https://www.positiveadversity.org/checkout/donate?donatePageId=5ef4fa4ebdc73e6a779e5220";

export const TEAM_DONATE_URL =
  "https://www.positiveadversity.org/checkout/donate?donatePageId=633dcf313d304d330d48c6f9";
