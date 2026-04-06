const BASE_URL = "https://api.company-information.service.gov.uk";

interface CompaniesHouseSearchParams {
  sicCodes: string[];
  postcodeArea: string;
  locationQuery?: string;
  status: string;
  incorporatedAfter: string;
  maxResults?: number;
}

interface CompaniesHouseCompany {
  company_number: string;
  company_name: string;
  registered_office_address: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
  };
  company_status: string;
  date_of_creation: string;
  sic_codes?: string[];
}

interface CompaniesHouseOfficer {
  name: string;
  officer_role: string;
  appointed_on?: string;
  resigned_on?: string;
}

export interface SearchResult {
  companyNumber: string;
  name: string;
  location: string;
  sicCodes: string[];
  incorporatedDate: string;
  source: string;
}

export interface OfficerResult {
  fullName: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface FilingInsights {
  accountsCategory: string | null;
  latestFilingDate: string | null;
  estimatedEmployees: number;
  estimatedRevenue: string | null;
}

function getAuthHeader(): string {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) return "";
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

const RATE_LIMIT_DELAY = 200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function search(
  params: CompaniesHouseSearchParams,
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const maxResults = params.maxResults || 500;
  let startIndex = 0;

  // Build full SIC code list for the API query. The CH API accepts
  // a comma-separated list of 5-digit SIC codes. We pass our prefix
  // targets as full codes (e.g. "69102" for solicitors).
  const sicCodesParam = params.sicCodes.join(",");

  while (results.length < maxResults) {
    const locationParam = params.locationQuery || params.postcodeArea;
    const searchUrl = `${BASE_URL}/advanced-search/companies?location=${encodeURIComponent(locationParam)}&company_status=${params.status}&incorporated_from=${params.incorporatedAfter}&sic_codes=${encodeURIComponent(sicCodesParam)}&size=100&start_index=${startIndex}`;

    const response = await fetch(searchUrl, {
      headers: { Authorization: getAuthHeader() },
    });

    if (!response.ok) break;

    const data = (await response.json()) as {
      items?: CompaniesHouseCompany[];
      total_results?: number;
    };
    const items = data.items || [];

    if (items.length === 0) break;

    for (const company of items) {
      const address = company.registered_office_address;
      const postcode = (address.postal_code || "")
        .toUpperCase()
        .replace(/\s+/g, "");
      const targetPrefix = params.postcodeArea.toUpperCase();
      if (!postcode.startsWith(targetPrefix)) continue;

      const location = [address.locality, address.region]
        .filter(Boolean)
        .join(", ");

      results.push({
        companyNumber: company.company_number,
        name: company.company_name,
        location: location || params.postcodeArea,
        sicCodes: company.sic_codes || [],
        incorporatedDate: company.date_of_creation,
        source: "companies_house",
      });
    }

    if (items.length < 100) break;
    startIndex += 100;
    await delay(RATE_LIMIT_DELAY);
  }

  return results.slice(0, maxResults);
}

export async function getOfficers(
  companyNumber: string,
): Promise<OfficerResult[]> {
  const url = `${BASE_URL}/company/${companyNumber}/officers`;
  const response = await fetch(url, {
    headers: { Authorization: getAuthHeader() },
  });

  if (!response.ok) return [];

  const data = (await response.json()) as {
    items?: CompaniesHouseOfficer[];
  };
  const officers = data.items || [];

  return officers
    .filter((o) => !o.resigned_on)
    .map((o) => {
      const parts = o.name.split(",").map((p) => p.trim());
      const lastName = parts[0] || "";
      const firstName = parts[1] || "";
      return {
        fullName: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        role: o.officer_role,
      };
    });
}

const ACCOUNTS_CATEGORY_EMPLOYEES: Record<string, number> = {
  dormant: 0,
  "micro-entity": 5,
  small: 25,
  medium: 100,
  "medium-sized": 100,
  large: 250,
  group: 200,
};

const ACCOUNTS_CATEGORY_REVENUE: Record<string, string> = {
  dormant: "Dormant",
  "micro-entity": "Under 632k",
  small: "Under 10.2M",
  medium: "Under 36M",
  "medium-sized": "Under 36M",
  large: "Over 36M",
  group: "Over 36M (group)",
};

export async function getFilingHistory(
  companyNumber: string,
): Promise<FilingInsights> {
  const url = `${BASE_URL}/company/${companyNumber}/filing-history?category=accounts&items_per_page=5`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: getAuthHeader() },
    });

    if (!response.ok) {
      return {
        accountsCategory: null,
        latestFilingDate: null,
        estimatedEmployees: 10,
        estimatedRevenue: null,
      };
    }

    const data = (await response.json()) as {
      items?: Array<{
        date: string;
        description: string;
        category: string;
        type?: string;
      }>;
    };

    const filings = data.items || [];
    if (filings.length === 0) {
      return {
        accountsCategory: null,
        latestFilingDate: null,
        estimatedEmployees: 10,
        estimatedRevenue: null,
      };
    }

    const latest = filings[0];
    const descLower = latest.description.toLowerCase();

    let accountsCategory: string | null = null;
    for (const category of Object.keys(ACCOUNTS_CATEGORY_EMPLOYEES)) {
      if (descLower.includes(category)) {
        accountsCategory = category;
        break;
      }
    }

    return {
      accountsCategory,
      latestFilingDate: latest.date,
      estimatedEmployees:
        accountsCategory
          ? ACCOUNTS_CATEGORY_EMPLOYEES[accountsCategory] ?? 10
          : 10,
      estimatedRevenue: accountsCategory
        ? ACCOUNTS_CATEGORY_REVENUE[accountsCategory] ?? null
        : null,
    };
  } catch {
    return {
      accountsCategory: null,
      latestFilingDate: null,
      estimatedEmployees: 10,
      estimatedRevenue: null,
    };
  }
}
