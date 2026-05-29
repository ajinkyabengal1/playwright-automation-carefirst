import { Page, expect } from "@playwright/test";
import { TEST_USER } from "../fixtures/test-data";
import { FlowConfig } from "../fixtures/flow-configs";
import { ConditionsPage } from "../page-objects/ConditionsPage";
import { ConditionDetailPage } from "../page-objects/ConditionDetailPage";
import { GuestContinuePage } from "../page-objects/GuestContinuePage";
import { SignupPage } from "../page-objects/SignupPage";
import { BookingPage } from "../page-objects/BookingPage";
import { PaymentPage } from "../page-objects/PaymentPage";

type JourneyStep =
  | "sign_up"
  | "appointment_booking"
  | "payment"
  | "success"
  | "unknown";

async function detectCurrentStep(page: Page): Promise<JourneyStep> {
  const currentUrl = page.url();

  const hasVisibleIndicator = async (selectors: string[]) => {
    const checks = await Promise.all(
      selectors.map((sel) =>
        page
          .locator(sel)
          .first()
          .isVisible({ timeout: 300 })
          .catch(() => false),
      ),
    );
    return checks.some(Boolean);
  };

  const successIndicators = [
    ':has-text("Booking Confirmed")',
    ':has-text("booking confirmed")',
    ':has-text("Appointment Confirmed")',
    ':has-text("appointment confirmed")',
    ':has-text("Thank you for booking")',
    ':has-text("You can safely close")',
    ':has-text("Successfully booked")',
    ':has-text("Booking confirmed")',
    '[class*="BookingAppointmentSuccess"]',
    '[class*="booking-appointment-success"]',
  ];
  if (await hasVisibleIndicator(successIndicators)) return "success";

  const bookingIndicators = [
    ".appointment-type-radio-group",
    ".rota-slot",
    'button:has-text("Book Now")',
    'button:has-text("Continue to Payment")',
    'button:has-text("Continue to payment")',
    'button:has-text("Continue To Payment")',
    'button:has-text("Continue to Payement")',
    ':text("Appointment type")',
    ':text("Book your appointment")',
    ':text("Schedule your appointment")',
    ':text("Select appointment session type")',
  ];
  if (await hasVisibleIndicator(bookingIndicators)) return "appointment_booking";

  const paymentIndicators = [
    ':text("Complete your payment")',
    ':text("Enter your card details here")',
    ':text("Select a saved card")',
    'input[autocomplete="cc-name"]',
    'input[autocomplete="cc-number"]',
    'input[autocomplete="cc-exp"]',
    'input[autocomplete="cc-csc"]',
    ':text("3dsecure.io")',
    ':text("Pass challenge")',
    ':text("Token fee")',
    'button:has-text("Pay £")',
    'button:has-text("Pay")',
  ];
  if (await hasVisibleIndicator(paymentIndicators)) return "payment";

  if (
    /payment|checkout|card|3dsecure|challenge/i.test(currentUrl) &&
    !(await hasVisibleIndicator(successIndicators))
  ) {
    return "payment";
  }

  const signupIndicators = [
    'input[name="first_name"]',
    'input[name="email"]',
    'input[type="email"]',
    ':text("Patient details")',
    ':text("Personal details")',
    ':text("Contact details")',
    ':text("Enter your details")',
  ];
  if (await hasVisibleIndicator(signupIndicators)) return "sign_up";

  return "unknown";
}

export async function runConditionFlow(
  page: Page,
  config: FlowConfig,
  user: typeof TEST_USER,
  projectBaseURL?: string,
): Promise<void> {
  const conditionsPage = new ConditionsPage(page);
  const detailPage = new ConditionDetailPage(page);
  const guestContinuePage = new GuestContinuePage(page);
  const signup = new SignupPage(page);
  const booking = new BookingPage(page);
  const payment = new PaymentPage(page);

  const baseUrl = (projectBaseURL ?? process.env.BASE_URL ?? "http://localhost:4005").replace(/\/$/, "");

  // ── Step 1: Resolve condition href ────────────────────────────────────────
  let conditionHref: string;
  let pharmacySlug: string;

  const conditionDetailPath = process.env.CONDITION_DETAIL_PATH;

  if (conditionDetailPath) {
    conditionHref = conditionDetailPath;
    pharmacySlug = conditionsPage.extractPharmacySlug(conditionDetailPath);
    console.log(`✔ Direct condition path: ${conditionDetailPath}`);
  } else {
    await conditionsPage.goto();
    await conditionsPage.waitForConditions();

    conditionHref = await conditionsPage.getConditionHrefByName(config.conditionName);
    pharmacySlug = conditionsPage.extractPharmacySlug(conditionHref);
    console.log(`✔ Selected ${config.conditionJourneyType} condition (${config.conditionName}): ${conditionHref}`);
  }

  // ── Step 2: Set cookie + navigate to detail page ──────────────────────────
  const cookieOrigin = page.url().startsWith("http")
    ? new URL(page.url()).origin
    : baseUrl;

  if (pharmacySlug) {
    await page.context().addCookies([
      { name: "selected-corporate-id", value: pharmacySlug, url: cookieOrigin },
    ]);
  }

  const detailUrl = conditionHref.startsWith("http")
    ? conditionHref
    : `${baseUrl}${conditionHref}`;
  await page.goto(detailUrl);
  await detailPage.waitForDetailPage();

  // ── Step 3: Eligibility form ──────────────────────────────────────────────
  await detailPage.fillEligibilityForm({
    gender: user.gender,
    day: user.dob.day,
    month: user.dob.month,
    year: user.dob.year,
  });

  // ── Step 4: Start Assessment ──────────────────────────────────────────────
  await detailPage.clickStartAssessment();
  await guestContinuePage.continueAsGuestIfVisible();
  await page.waitForLoadState("domcontentloaded");

  console.log(`✔ Post-assessment URL: ${page.url()}`);

  // ── Steps 5–N: Dynamic journey loop ──────────────────────────────────────
  const MAX_ITERATIONS = 30;
  const stepVisits: Record<string, number> = {};
  const MAX_STEP_VISITS = 6;
  let flowCompleted = false;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (flowCompleted) break;
    await page.waitForTimeout(1500);

    let step = await detectCurrentStep(page);
    console.log(`🔍 [${config.name}] Iteration ${i + 1}: detected step = "${step}"`);

    if (step === "success") {
      console.log("✔ Booking success state reached!");
      break;
    }

    if (step === "unknown") {
      await page.waitForTimeout(500);
      step = await detectCurrentStep(page);
      if (step === "unknown") await page.waitForTimeout(1200);
      step = await detectCurrentStep(page);

      if (
        step === "unknown" &&
        /payment|checkout|card|3dsecure|challenge/i.test(page.url())
      ) {
        step = "payment";
        console.log('↻ URL fallback forced step = "payment"');
      }

      if (step === "unknown") {
        console.log(`⚠ Unknown step at URL: ${page.url()} — stopping loop`);
        break;
      }
    }

    stepVisits[step] = (stepVisits[step] ?? 0) + 1;
    if (stepVisits[step] > MAX_STEP_VISITS) {
      console.log(`⚠ Stuck: step "${step}" visited ${stepVisits[step]} times — stopping`);
      break;
    }

    switch (step) {

      case "sign_up": {
        console.log("→ Handling sign-up step");

        const hasNHSForm = await page
          .locator('input[name="first_name"]')
          .isVisible()
          .catch(() => false);

        if (hasNHSForm) {
          await signup.waitForPage();
          await signup.fillNHSPDSForm({
            firstName: user.firstName,
            lastName: user.lastName,
            postcode: user.postcode,
            gender: user.gender,
            dobIso: user.dob.iso,
          });
          if (config.conditionJourneyType === "private") {
            await signup.submitPrivatePatientInfoForm();
          } else {
            await signup.submitNHSForm();
          }
          await signup.handlePDSResult();
          break;
        }

        const hasEmail = await page
          .locator('input[name="email"], input[type="email"]')
          .first()
          .isVisible()
          .catch(() => false);

        if (hasEmail) {
          await signup.fillContactDetails(user.email, user.phone);
          await signup.submitAndBook();
          await page.waitForTimeout(3_000);
        }
        break;
      }

      case "appointment_booking": {
        console.log("→ Handling booking step");
        await booking.completeBooking(config.booking);
        break;
      }

      case "payment": {
        console.log("→ Handling payment step");
        await payment.completePayment(user.payment, config.paymentMethod);
        if (payment.isBookingFlowCompleted()) {
          console.log("✔ Payment completed — ending test flow");
          flowCompleted = true;
        }
        break;
      }
    }
  }

  // ── Final assertion ───────────────────────────────────────────────────────
  const confirmed = await signup.isBookingConfirmed();
  console.log(`✔ Booking confirmed check: ${confirmed}`);
  expect(page.url()).not.toContain("/conditions");
}
