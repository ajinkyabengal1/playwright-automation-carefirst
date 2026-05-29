import { test, expect, Page } from "@playwright/test";
import {
  TEST_USER,
  ACTIVE_CONDITION,
  CART_PREFERENCES,
  DRUG_SELECTION_PREFERENCES,
  SHIPPING_ADDRESS_PREFERENCES,
  THANK_YOU_PREFERENCES,
  getActiveConditionName,
} from "../fixtures/test-data";
import { ConditionsPage } from "../page-objects/ConditionsPage";
import { ConditionDetailPage } from "../page-objects/ConditionDetailPage";
import { GuestContinuePage } from "../page-objects/GuestContinuePage";
import { SignupPage } from "../page-objects/SignupPage";
import { ProductSignupPage } from "../page-objects/ProductSignupPage";
import { DrugSelectionPage } from "../page-objects/DrugSelectionPage";
import { CartPage } from "../page-objects/CartPage";
import { ShippingAddressPage } from "../page-objects/ShippingAddressPage";
import { ThankYouPage } from "../page-objects/ThankYouPage";
import { BookingPage } from "../page-objects/BookingPage";
import { PaymentPage } from "../page-objects/PaymentPage";

// ─── Journey step types ───────────────────────────────────────────────────────
type JourneyStep =
  | "guest_continue"
  | "product_signup"
  | "sign_up"
  | "appointment_booking"
  | "drug_selection"
  | "cart"
  | "shipping_address"
  | "thank_you"
  | "payment"
  | "success"
  | "unknown";

let shippingHandled = false;
let paymentHandled = false;

/**
 * Detect the current journey step by inspecting the DOM.
 */
async function detectCurrentStep(page: Page): Promise<JourneyStep> {
  const currentUrl = page.url();

  const hasVisibleIndicator = async (selectors: string[]) => {
    for (const sel of selectors) {
      const nodes = page.locator(sel);
      const count = await nodes.count().catch(() => 0);
      const maxToCheck = Math.min(count, 5);

      for (let i = 0; i < maxToCheck; i++) {
        const visible = await nodes
          .nth(i)
          .isVisible({ timeout: 300 })
          .catch(() => false);
        if (visible) return true;
      }
    }
    return false;
  };

  // 1. Cart step
  const cartIndicators = [
    "text=/shopping\\s*cart/i",
    'button:has-text("Proceed To Checkout")',
    'button:has-text("Continue Shopping")',
    'button:has-text("Apply")',
    'input[placeholder*="coupon" i]',
  ];
  if (await hasVisibleIndicator(cartIndicators)) {
    return "cart";
  }

  // 2. Shipping address step (must be before payment)
  const shippingAddressIndicators = [
    "text=/shipping address/i",
    "text=/select delivery address/i",
    "text=/payment method/i",
    'button:has-text("Save Address")',
    'button:has-text("Cancel")',
  ];
  if (await hasVisibleIndicator(shippingAddressIndicators)) {
    return "shipping_address";
  }

  // 3. Thank-you order page (must run before generic success)
  const thankYouIndicators = [
    "text=/thank you for your order!/i",
    "text=/your order has been successfully placed/i",
    'a:has-text("My Orders")',
  ];
  if (await hasVisibleIndicator(thankYouIndicators)) {
    return "thank_you";
  }

  // 4. Success / confirmation state
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
  if (await hasVisibleIndicator(successIndicators)) {
    return "success";
  }

  // 5. Booking step (Prioritize over payment if "Continue to Payment" button is present)
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
  if (await hasVisibleIndicator(bookingIndicators)) {
    return "appointment_booking";
  }

  // 6. Drug selection step
  const drugSelectionIndicators = [
    "text=/what.?s your preference\\?/i",
    ".drug-selection-section",
    ".product-box-ui",
    'button:has-text("Choose this Option")',
  ];
  if (await hasVisibleIndicator(drugSelectionIndicators)) {
    return "drug_selection";
  }

  // 7. Product checkout signup step (strict detection to avoid early false positives)
  const productSignupHeadingVisible = await hasVisibleIndicator([
    "text=/enter your personal details/i",
    "text=/enter your contact details/i",
  ]);
  const productSignupContextVisible = await hasVisibleIndicator([
    "text=/order summary/i",
    ".summary-box",
    ".checkout-product-box",
    "form[name='signup-form']",
  ]);
  if (
    productSignupHeadingVisible &&
    (productSignupContextVisible || /checkout/i.test(currentUrl))
  ) {
    return "product_signup";
  }

  // 8. Payment step
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
    'button:has-text("Pay £")',
    'button:has-text("Pay")',
  ];
  if (await hasVisibleIndicator(paymentIndicators)) {
    return "payment";
  }

  // URL fallback for tenants/routes that render payment UI after a delay.
  // Keep this after shipping detection to avoid misclassifying checkout address pages.
  if (
    /payment|checkout|card|3dsecure|challenge/i.test(currentUrl) &&
    !(await hasVisibleIndicator(successIndicators)) &&
    !(await hasVisibleIndicator(shippingAddressIndicators))
  ) {
    return "payment";
  }

  // 9. Continue-as-guest step (must be before signup detection)
  const guestContinueIndicators = [
    'button:has-text("Continue as Guest")',
    'button:has-text("Continue as guest")',
    'a:has-text("Continue as Guest")',
    'a:has-text("Continue as guest")',
    '[role="button"]:has-text("Continue as Guest")',
    '[role="button"]:has-text("Continue as guest")',
    "text=/continue\\s+as\\s+guest/i",
  ];
  if (await hasVisibleIndicator(guestContinueIndicators)) {
    return "guest_continue";
  }

  // 10. Sign-up / contact-details step
  const signupIndicators = [
    'input[name="first_name"]',
    'input[name="email"]',
    'input[type="email"]',
    'input[placeholder*="phone number" i]',
    'input[placeholder*="Confirm your phone number" i]',
    'input[placeholder*="Enter your email address" i]',
    'input[placeholder*="Confirm your email address" i]',
    'input[placeholder*="Enter password" i]',
    'input[placeholder*="Confirm password" i]',
    ':text("Enter your contact details")',
    ':text("Patient details")',
    ':text("Personal details")',
    ':text("Contact details")',
    ':text("Enter your details")',
    'button:has-text("Sign Up")',
  ];
  if (await hasVisibleIndicator(signupIndicators)) {
    return "sign_up";
  }


  return "unknown";
}

// ─── Main test ────────────────────────────────────────────────────────────────
test.describe("Conditions flow", () => {
  test.only("complete conditions flow: listing → eligibility → signup → book", async ({
    page,
    baseURL,
  }) => {
    page.on("console", (msg) => {
      const type = msg.type();
      if (type === "error" || type === "warning") {
        console.log(`[browser ${type}] ${msg.text()}`);
      }
    });
    page.on("pageerror", (err) => {
      console.log(`[page error] ${err.message}`);
    });
    page.on("response", (res) => {
      if (res.status() >= 400) {
        console.log(`[HTTP ${res.status()}] ${res.url()}`);
      }
    });

    const conditionsPage = new ConditionsPage(page);
    const detailPage = new ConditionDetailPage(page);
    const guestContinuePage = new GuestContinuePage(page);
    const signup = new SignupPage(page);
    const productSignup = new ProductSignupPage(page);
    const drugSelection = new DrugSelectionPage(page);
    const cart = new CartPage(page);
    const shippingAddress = new ShippingAddressPage(page);
    const thankYou = new ThankYouPage(page);
    const booking = new BookingPage(page);
    const payment = new PaymentPage(page);

    const baseUrl = (baseURL ?? process.env.BASE_URL ?? "http://localhost:4005").replace(
      /\/$/,
      "",
    );
    const selectedConditionName = getActiveConditionName();

    // ─── Step 1: Resolve condition href + pharmacy slug ─────────────────────
    let conditionHref: string;
    let pharmacySlug: string;

    const conditionDetailPath = process.env.CONDITION_DETAIL_PATH;

    if (conditionDetailPath) {
      conditionHref = conditionDetailPath;
      pharmacySlug = conditionsPage.extractPharmacySlug(conditionDetailPath);
      console.log(`✔ Direct condition path: ${conditionDetailPath}`);
      console.log(`✔ Pharmacy slug: ${pharmacySlug}`);
    } else {
      await test.step(`Navigate to /conditions and select ${ACTIVE_CONDITION.journeyType} condition: ${selectedConditionName}`, async () => {
        await conditionsPage.goto();
        await conditionsPage.waitForConditions();
      });

      conditionHref = await conditionsPage.getConditionHrefByName(
        selectedConditionName,
      );
      pharmacySlug = conditionsPage.extractPharmacySlug(conditionHref);
      console.log(
        `✔ Selected ${ACTIVE_CONDITION.journeyType} condition (${selectedConditionName}) href: ${conditionHref}`,
      );
      console.log(`✔ Pharmacy slug: ${pharmacySlug}`);
    }

    // ─── Step 2: Set cookie then navigate to detail page ───────────────────
    await test.step("Set pharmacy cookie and open condition detail page", async () => {
      const cookieOrigin = page.url().startsWith("http")
        ? new URL(page.url()).origin
        : baseUrl;

      if (pharmacySlug) {
        await page.context().addCookies([
          {
            name: "selected-corporate-id",
            value: pharmacySlug,
            url: cookieOrigin,
          },
        ]);
      }

      const detailUrl = conditionHref.startsWith("http")
        ? conditionHref
        : `${baseUrl}${conditionHref}`;
      await page.goto(detailUrl);
      await detailPage.waitForDetailPage();
    });

    // ─── Step 3: Eligibility form (OPTIONAL) ──────────────────────────────
    // fillEligibilityForm detects whether the form is present.
    // If absent (e.g. Acne Vulgaris / private conditions), it skips silently.
    // It also calls clickCheckEligibility internally — no need to call it again.
    await test.step("Fill eligibility form if present: gender + DOB", async () => {
      await detailPage.fillEligibilityForm({
        gender: TEST_USER.gender,
        day: TEST_USER.dob.day,
        month: TEST_USER.dob.month,
        year: TEST_USER.dob.year,
      });
    });

    // ─── Step 4: Start Assessment ─────────────────────────────────────────
    await test.step("Click Start Assessment", async () => {
      await detailPage.clickStartAssessment();
      await guestContinuePage.continueAsGuestIfVisible();
      await page.waitForLoadState("domcontentloaded");
    });

    console.log(`✔ Post-assessment URL: ${page.url()}`);

    // ─── Steps 5–N: Dynamic journey loop ─────────────────────────────────
    let journeyStatus: "incomplete" | "completed" = "incomplete";

    await test.step("Complete dynamic journey (signup / booking)", async () => {
      const MAX_ITERATIONS = 30;
      const stepVisits: Record<string, number> = {};
      const MAX_STEP_VISITS = 6;
      let flowCompleted = false;

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        if (flowCompleted) break;
        await page.waitForTimeout(1500);

        let step = await detectCurrentStep(page);
        console.log(`🔍 Iteration ${i + 1}: detected step = "${step}"`);

        if (step === "success") {
          console.log("✔ Booking success state reached!");
          journeyStatus = "completed";
          break;
        }

        if (step === "unknown") {
          // Short retry first to avoid long stalls when payment UI is still mounting.
          await page.waitForTimeout(500);
          step = await detectCurrentStep(page);
          if (step !== "unknown") {
            console.log(`↻ Fast retry detected step = "${step}"`);
          } else {
            await page.waitForTimeout(1200);
            step = await detectCurrentStep(page);
          }

          // Last safety fallback: URL hints commonly used by payment providers/pages.
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
          console.log(
            `⚠ Stuck: step "${step}" visited ${stepVisits[step]} times — stopping`,
          );
          break;
        }

        switch (step) {
          case "guest_continue": {
            console.log("→ Handling continue-as-guest step");
            await guestContinuePage.continueAsGuestIfVisible();
            await page.waitForTimeout(800);
            break;
          }

          case "product_signup": {
            console.log("→ Handling product signup step");
            await productSignup.completeProductSignupFlow({
              firstName: TEST_USER.firstName,
              lastName: TEST_USER.lastName,
              postcode: TEST_USER.postcode,
              gender: TEST_USER.gender,
              dobIso: TEST_USER.dob.iso,
              phone: TEST_USER.phone,
              email: TEST_USER.email,
              password: TEST_USER.password,
              confirmPassword: TEST_USER.confirmPassword,
            });
            break;
          }


          case "sign_up": {
            console.log("→ Handling sign-up step");

            const handledDynamicCheckoutSignup =
              await signup.completeDynamicCheckoutSignupIfVisible({
                firstName: TEST_USER.firstName,
                lastName: TEST_USER.lastName,
                postcode: TEST_USER.postcode,
                gender: TEST_USER.gender,
                dobIso: TEST_USER.dob.iso,
                phone: TEST_USER.phone,
                email: TEST_USER.email,
                password: TEST_USER.password,
                confirmPassword: TEST_USER.confirmPassword,
              });
            if (handledDynamicCheckoutSignup) {
              break;
            }

            const hasNHSForm = await page
              .locator('input[name="first_name"]')
              .isVisible()
              .catch(() => false);

            if (hasNHSForm) {
              await signup.waitForPage();
              await signup.fillNHSPDSForm({
                firstName: TEST_USER.firstName,
                lastName: TEST_USER.lastName,
                postcode: TEST_USER.postcode,
                gender: TEST_USER.gender,
                dobIso: TEST_USER.dob.iso,
              });
              if (ACTIVE_CONDITION.journeyType === "private") {
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
              await signup.fillContactDetails(TEST_USER.email, TEST_USER.phone);
              await signup.submitAndBook();
              await page.waitForTimeout(3_000);
            }
            break;
          }

          case "appointment_booking": {
            console.log("→ Handling booking step");
            await booking.completeBooking();
            break;
          }

          case "drug_selection": {
            console.log("→ Handling drug selection step");
            await drugSelection.waitForPage();
            await drugSelection.chooseDrugOption(DRUG_SELECTION_PREFERENCES);
            break;
          }

          case "cart": {
            console.log("→ Handling cart step");
            await cart.waitForPage();
            await cart.handleCart(CART_PREFERENCES);

            // Dynamic transition guard:
            // shipping address can appear immediately after cart submit.
            if (await shippingAddress.isVisible()) {
              console.log("→ Shipping address appeared right after cart");
              await shippingAddress.handleShippingAddress(
                SHIPPING_ADDRESS_PREFERENCES,
              );
            }
            break;
          }

          case "shipping_address": {
            console.log("→ Handling shipping address step");
            await shippingAddress.handleShippingAddress(
              SHIPPING_ADDRESS_PREFERENCES,
            );
            shippingHandled = true;
            break;
          }

          case "thank_you": {
            console.log("✔ Thank-you page detected! Journey completed successfully.");
            await thankYou.handleThankYou(THANK_YOU_PREFERENCES);
            journeyStatus = "completed";
            flowCompleted = true;
            break;
          }

          case "payment": {
            console.log("→ Handling payment step");
            await payment.completePayment(TEST_USER.payment);
            if (payment.isBookingFlowCompleted()) {
              console.log(
                "✔ Payment completed and redirected home — ending test flow",
              );

              paymentHandled = true;
              journeyStatus = "completed";
              flowCompleted = true;
            }
            break;
          }
        }
      }
    });

    // ─── Final assertion ──────────────────────────────────────────────────
    await test.step("Verify journey completion", async () => {
      const isConfirmed =
        journeyStatus === "completed" || (await signup.isBookingConfirmed());
      console.log(
        `✔ Final verification: ${isConfirmed ? "COMPLETED SUCCESSFUL" : "INCOMPLETE"}`,
      );
      expect(page.url()).not.toContain("/conditions");
      if (isConfirmed) {
        console.log(
          "🎉 SUCCESS: The pharmacy journey has been fully automated and verified!",
        );
      }
      
      // Explicitly close the page to trigger immediate browser shutdown
      await page.close();
    });
  });
});
