import { faker } from '@faker-js/faker'

const MOCK_ENDPOINTS_URL = '/mock-endpoints.json'
const MOCK_CURRENCY = 'NGN'

export async function loadMockEndpoints() {
  const response = await fetch(MOCK_ENDPOINTS_URL)

  if (!response.ok) {
    throw new Error(`Unable to load mock endpoint configuration (${response.status}).`)
  }

  const catalog = await response.json()

  if (!Array.isArray(catalog?.endpoints)) {
    throw new Error('The mock endpoint configuration is invalid.')
  }

  return catalog.endpoints
}

export function buildMockRequestUrl(endpoint, parameters) {
  const query = new URLSearchParams(parameters)
  return `${endpoint.path}?${query.toString()}`
}

export async function executeMockRequest(endpoint, parameters) {
  if (!endpoint || !endpoint.mockType) {
    throw new Error('The selected mock endpoint is not configured.')
  }

  await Promise.resolve()

  return {
    status: '00',
    message: 'Successful',
    result: generateResult(endpoint.mockType, parameters),
  }
}

function generateResult(mockType, parameters) {
  switch (mockType) {
    case 'accountDetails':
      return generateAccountDetails(parameters.AccountNo)
    case 'transactions':
      return generateTransactions(parameters.AccountNo, parameters.Count)
    case 'transactionCount':
      return { nuban: parameters.AccountNo, transaction_count: faker.number.int({ min: 10, max: 500 }) }
    case 'signatories':
      return generateSignatories(parameters.AccountNo)
    case 'otherAccounts':
      return generateOtherAccounts(parameters.CustomerNo)
    case 'accountsByIdentifier':
      return generateAccountsByIdentifier(parameters.IdentifierType, parameters.Identifier)
    case 'customerIndebtedness':
      return generateIndebtedness(parameters.CustomerNo)
    case 'customerSignature':
      return {
        customer_no: parameters.CustomerNo,
        signature: faker.image.avatar(),
        signature_status: faker.helpers.arrayElement(['Available', 'Pending verification']),
        document_id: `SIG-${faker.string.alphanumeric(10).toUpperCase()}`,
        last_updated: formatDate(faker.date.recent({ days: 180 })),
      }
    case 'pendingDebits':
      return generatePendingDebits(parameters.AccountNo)
    default:
      throw new Error(`No mock data generator is registered for "${mockType}".`)
  }
}

function generateAccountDetails(accountNumber) {
  const name = faker.person.fullName()
  const balance = amount(100000, 9000000)

  return {
    name,
    type: faker.helpers.arrayElement(['Savings', 'Current', 'Domiciliary']),
    category: faker.helpers.arrayElement(['Customers Savings', 'Personal Current', 'SME Current']),
    clr_bal: balance,
    avl_bal: balance,
    nuban: accountNumber,
    address: faker.location.streetAddress(),
    email: faker.internet.email({ firstName: name.split(' ')[0] }),
    telephone: `0${faker.string.numeric(10)}`,
    currency: MOCK_CURRENCY,
    aod: formatDate(faker.date.past({ years: 15 })),
    branch: faker.helpers.arrayElement(['Ahmadu Bello', 'Victoria Island', 'Marina', 'Ikeja']),
    sort_code: faker.string.numeric(3),
    account_status: faker.helpers.arrayElement(['Active', 'Active', 'Dormant']),
    account_flag_status: null,
    bvn: faker.string.numeric(11),
    nin: faker.helpers.maybe(() => faker.string.numeric(11), { probability: 0.7 }) ?? null,
    tin: faker.helpers.maybe(() => faker.string.numeric(10), { probability: 0.4 }) ?? null,
  }
}

function generateTransactions(accountNumber, requestedCount) {
  const count = Math.min(Math.max(Number.parseInt(requestedCount, 10) || 5, 1), 25)

  return Array.from({ length: count }, () => {
    const isDebit = faker.datatype.boolean()

    return {
        status: 'Successful',
      tra_date: faker.date.recent({ days: 90 }).toISOString(),
      val_date: faker.date.recent({ days: 90 }).toISOString(),
      narration: faker.helpers.arrayElement([
        'POS purchase',
        'Funds transfer',
        'Salary payment',
        'Utility bill payment',
        'Cash withdrawal',
        'Account maintenance fee',
        'airtime recharge',
      ]),
      debit: isDebit ? amount(500, 250000) : '0.00',
      credit: isDebit ? '0.00' : amount(1000, 750000),
      currency: MOCK_CURRENCY,
      tra_bal: amount(1000, 5000000),
    }
  })
}

function generateSignatories(accountNumber) {
  return Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, (_, index) => ({
    name: faker.person.fullName(),
    bvn: faker.string.numeric(11),
    date_of_birth: formatDate(faker.date.birthdate({ min: 18, max: 65 })),
    email: faker.internet.email(),
    telephone: `0${faker.string.numeric(10)}`,
  }))
}

function generateOtherAccounts(customerNumber) {
  return {
    customer_no: customerNumber,
    accounts: Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () => generateAccountSummary()),
  }
}

function generateAccountsByIdentifier(identifierType, identifier) {
  return {
    identifier_type: identifierType,
    identifier,
    accounts: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => generateAccountSummary()),
  }
}

function generateAccountSummary() {
  return {
    account_status: 'Active',
    name: faker.person.fullName(),
    nuban: faker.string.numeric(10),
    currency: MOCK_CURRENCY,
    avl_bal: amount(1000, 5000000),
    
  }
}

function generateIndebtedness(customerNumber) {
     return {
    account_status: 'Active',
    customer_name: faker.person.fullName(),
    nuban: faker.string.numeric(10),
    total_indebtedness: amount(1000, 5000000),
    currency: MOCK_CURRENCY,
    avl_bal: amount(1000, 5000000),
  }
}

function generatePendingDebits(accountNumber) {
  return Array.from({ length: faker.number.int({ min: 0, max: 5 }) }, () => ({
    account_no: accountNumber,
    bank_code: faker.string.numeric(3),
    bank_name: faker.company.name(),
    initiated_date: formatDate(faker.date.recent({ days: 30 })),
    payment_date: formatDate(faker.date.soon({ days: 30 })),
    type: faker.helpers.arrayElement(['Standing Order', 'Direct Debit', 'ACH Debit']),
    status: faker.helpers.arrayElement(['Pending', 'Completed', 'Failed']),
  }))
}

function amount(min, max) {
  return faker.number.float({ min, max, fractionDigits: 2 }).toFixed(2)
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}-${month}-${date.getFullYear()}`
}
