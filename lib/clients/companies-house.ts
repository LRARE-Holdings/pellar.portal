const BASE_URL = "https://api.company-information.service.gov.uk";

interface CompaniesHouseSearchParams {
  sicCodes: string[];
  postcodeArea: string;
  status: string;
  incorporatedAfter: string;
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

interface SearchResult {
  companyNumber: string;
  name: string;
  location: string;
  sicCodes: string[];
  incorporatedDate: string;
  source: string;
}

interface OfficerResult {
  fullName: string;
  firstName: string;
  lastName: string;
  role: string;
}

function getAuthHeader(): string {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) return "";
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

export async function search(
  params: CompaniesHouseSearchParams,
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  const searchUrl = `${BASE_URL}/advanced-search/companies?location=${params.postcodeArea}&company_status=${params.status}&incorporated_from=${params.incorporatedAfter}&size=100`;

  const response = await fetch(searchUrl, {
    headers: { Authorization: getAuthHeader() },
  });

  if (!response.ok) return results;

  const data = (await response.json()) as {
    items?: CompaniesHouseCompany[];
  };
  const items = data.items || [];

  for (const company of items) {
    // Verify postcode actually starts with the target area code
    const address = company.registered_office_address;
    const postcode = (address.postal_code || "").toUpperCase().replace(/\s+/g, "");
    const targetPrefix = params.postcodeArea.toUpperCase();
    if (!postcode.startsWith(targetPrefix)) continue;

    const companySicCodes = company.sic_codes || [];
    const matchesSector = companySicCodes.some((sic) =>
      params.sicCodes.some((target) => sic.startsWith(target)),
    );

    if (!matchesSector) continue;

    const location = [address.locality, address.region]
      .filter(Boolean)
      .join(", ");

    results.push({
      companyNumber: company.company_number,
      name: company.company_name,
      location: location || params.postcodeArea,
      sicCodes: companySicCodes,
      incorporatedDate: company.date_of_creation,
      source: "companies_house",
    });
  }

  return results;
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
