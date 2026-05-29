import { Page } from "@playwright/test";
import { THANK_YOU_PREFERENCES, ThankYouPreferences } from "../fixtures/test-data";

export class ThankYouPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async isVisible(): Promise<boolean> {
    const indicators = [
      "text=/thank you for your order!/i",
      "text=/your order has been successfully placed/i",
      "text=/order summary/i",
      'a:has-text("My Orders")',
      'a:has-text("Continue Shopping")',
    ];

    for (const sel of indicators) {
      const nodes = this.page.locator(sel);
      const count = await nodes.count().catch(() => 0);
      for (let i = 0; i < Math.min(count, 6); i++) {
        const visible = await nodes
          .nth(i)
          .isVisible({ timeout: 300 })
          .catch(() => false);
        if (visible) return true;
      }
    }

    return false;
  }

  async handleThankYou(
    prefs: ThankYouPreferences = THANK_YOU_PREFERENCES,
  ): Promise<boolean> {
    if (!(await this.isVisible())) return false;

    const target =
      prefs.action === "My Orders"
        ? this.page
            .locator(
              'a:has-text("My Orders"), button:has-text("My Orders"), text=/my\s*orders/i',
            )
            .first()
        : this.page
            .locator(
              'a:has-text("Continue Shopping"), button:has-text("Continue Shopping"), text=/continue\s*shopping/i',
            )
            .first();

    if (await target.isVisible().catch(() => false)) {
      await target.scrollIntoViewIfNeeded().catch(() => {});
      await target.click({ force: true }).catch(async () => {
        await target.evaluate((el: HTMLElement) => el.click());
      });
      await this.page.waitForLoadState("domcontentloaded").catch(() => {});
      await this.page.waitForTimeout(1000);
      return true;
    }

    return false;
  }
}
