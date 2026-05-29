# Pharmacy E2E Tests

Standalone Playwright E2E test suite for pharmacy apps. Tests the full conditions flow:

`/conditions` → condition detail → eligibility check → questionnaire → NHS PDS signup → booking

---

## Requirements

- [Node.js](https://nodejs.org/) 18+
- [npm](https://npmjs.com/) (or pnpm/yarn)
- The pharmacy app running and accessible

---

## Setup

### 1. Install dependencies

```bash
npm install
npx playwright install chromium
```

### 2. Configure the base URL

Copy `.env.example` to `.env` and set your target app URL:

```bash
cp .env.example .env
```

Edit `.env`:

```
BASE_URL=http://localhost:4005
```

Replace `http://localhost:4005` with the URL of any pharmacy app instance you want to test against.

---

## Running Tests

```bash
# Run all tests (headless)
npm test

# Run with a visible browser window
npm run test:headed

# Run in debug mode (step through each action)
npm run test:debug

# View the HTML report after a run
npm run test:report
```

---

## Test Data

Test user data is hardcoded in `tests/fixtures/test-data.ts`:

| Field     | Value                       |
|-----------|-----------------------------|
| Gender    | Male                        |
| DOB       | 01/01/1990                  |
| First name| John                        |
| Last name | Smith                       |
| Postcode  | SW1A 1AA                    |
| Email     | john.smith@test.example.com |
| Phone     | 07700900000                 |

To change test data, edit `tests/fixtures/test-data.ts` directly.

---

## Project Structure

```
pharmacy-e2e-tests/
├── playwright.config.ts          # Playwright config (reads BASE_URL from .env)
├── tsconfig.json
├── .env.example                  # Template env file
├── .env                          # Your local env (not committed)
└── tests/
    ├── fixtures/
    │   └── test-data.ts          # Hardcoded test user data
    ├── page-objects/
    │   ├── ConditionsPage.ts     # /conditions listing POM
    │   ├── ConditionDetailPage.ts # Detail page + eligibility form POM
    │   ├── QuestionnairePage.ts  # Questionnaire wizard POM
    │   └── SignupPage.ts         # NHS PDS signup + booking POM
    └── e2e/
        └── condition-flow.spec.ts # Main E2E test spec
```

---

## Reusing for Other Pharmacy Apps

This project is designed to work against any pharmacy app with the same flow.

1. Clone / copy this project
2. Set `BASE_URL` in `.env` to the target app's URL
3. Run `npm test`

The test automatically:
- Picks the **first condition** from the `/conditions` listing
- Extracts the pharmacy slug from the condition link to set the required `selected-corporate-id` cookie
- Handles both NHS PDS "match found" and "no match" paths through the signup form

---

## Troubleshooting

**Tests fail with timeout on `/conditions`**
- Ensure the app is running and reachable at `BASE_URL`
- Check that `/conditions` returns a list of conditions

**Detail page returns 404**
- The test extracts the pharmacy slug automatically and sets the `selected-corporate-id` cookie
- Verify the condition card links have the format `/{pharmacySlug}/conditions/{conditionSlug}`

**NHS PDS check fails**
- This is expected — the test user (John Smith, SW1A 1AA, 01/01/1990) is unlikely to match a real NHS record
- The app should show a manual signup form when no record is found; the test continues through this path

**Screenshots and videos**
- Saved to `test-results/` directory on failure
- Run `npm run test:report` to open the HTML report
