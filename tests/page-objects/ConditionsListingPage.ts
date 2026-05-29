import { type Page, type Locator } from '@playwright/test';

export class ConditionsListingPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(queryParams?: string) {
    const url = queryParams ? `/conditions${queryParams}` : '/conditions';
    await this.page.goto(url);
    // Dismiss cookie banner if present
    const cookieBtn = this.page.locator('button:has-text("Accept"), button:has-text("Accept All"), button:has-text("Got it")').first();
    try {
      await cookieBtn.click({ timeout: 4000 });
    } catch {
      // No cookie banner — continue
    }
  }

  async waitForPageLoad() {
    await this.page.waitForSelector('a.condition-card', { timeout: 20000 });
  }

  // ─── Condition Cards ─────────────────────────────────────────────────────

  getConditionCards(): Locator {
    return this.page.locator('a.condition-card');
  }

  async getVisibleConditionCount(): Promise<number> {
    return this.getConditionCards().count();
  }

  // ─── Search ──────────────────────────────────────────────────────────────

  getSearchInput(): Locator {
    return this.page.locator('input[placeholder*="condition"], input[placeholder*="health"], input[placeholder*="Search"]').first();
  }

  async hasExplicitSearchButton(): Promise<boolean> {
    return this.page.locator('button:has-text("Search")').isVisible({ timeout: 3000 }).catch(() => false);
  }

  async searchFor(term: string) {
    const input = this.getSearchInput();
    await input.clear();
    await input.fill(term);

    if (await this.hasExplicitSearchButton()) {
      await this.page.locator('button:has-text("Search")').click();
    } else {
      // Debounced input — wait for debounce to fire
      await this.page.waitForTimeout(900);
    }
  }

  async clearSearch() {
    const input = this.getSearchInput();
    await input.clear();

    if (await this.hasExplicitSearchButton()) {
      await this.page.locator('button:has-text("Search")').click();
    } else {
      await this.page.waitForTimeout(900);
    }
  }

  async getNoResultsMessage(): Promise<Locator> {
    return this.page.locator('text=/no results|no conditions|not found/i');
  }

  // ─── Alphabet Navigation ─────────────────────────────────────────────────

  getAlphabetNavButtons(): Locator {
    // Single uppercase letter buttons in the alphabet sidebar
    return this.page.locator('button').filter({ hasText: /^[A-Z]$/ });
  }

  getAlphabetLetterButton(letter: string): Locator {
    return this.page.locator('button').filter({ hasText: new RegExp(`^${letter}$`) });
  }

  async isLetterEnabled(letter: string): Promise<boolean> {
    const btn = this.getAlphabetLetterButton(letter);
    const isDisabled = await btn.getAttribute('disabled');
    if (isDisabled !== null) return false;
    const classes = await btn.getAttribute('class') ?? '';
    if (classes.includes('cursor-not-allowed')) return false;
    return true;
  }

  async getEnabledLetters(): Promise<string[]> {
    const buttons = await this.getAlphabetNavButtons().all();
    const enabled: string[] = [];
    for (const btn of buttons) {
      const isDisabled = await btn.getAttribute('disabled');
      const classes = await btn.getAttribute('class') ?? '';
      if (isDisabled === null && !classes.includes('cursor-not-allowed')) {
        const text = (await btn.innerText()).trim();
        enabled.push(text);
      }
    }
    return enabled;
  }

  async getFirstEnabledLetter(): Promise<string | null> {
    const enabled = await this.getEnabledLetters();
    return enabled[0] ?? null;
  }

  async getLastEnabledLetter(): Promise<string | null> {
    const enabled = await this.getEnabledLetters();
    return enabled[enabled.length - 1] ?? null;
  }

  async clickAlphabetLetter(letter: string) {
    await this.getAlphabetLetterButton(letter).click();
  }

  getAlphabetSection(letter: string): Locator {
    return this.page.locator(`#${letter}`);
  }

  async isAlphabetNavVisible(): Promise<boolean> {
    // Check the first alphabet button is visible
    return this.page.locator('button').filter({ hasText: /^[A-Z]$/ }).first().isVisible({ timeout: 3000 }).catch(() => false);
  }

  // ─── Service Filter ───────────────────────────────────────────────────────

  /**
   * Returns true if the page has any form of service filter (Ant Select or CustomTab).
   */
  async hasServiceFilter(): Promise<boolean> {
    const antSelect = this.page.locator('.filter-select, .sorting-dropdown').first();
    const customTab = this.page.locator('.conditions-custom-tab').first();
    const [antVisible, tabVisible] = await Promise.all([
      antSelect.isVisible({ timeout: 3000 }).catch(() => false),
      customTab.isVisible({ timeout: 3000 }).catch(() => false),
    ]);
    return antVisible || tabVisible;
  }

  /**
   * Returns true if the filter UI is the paydens-style CustomTab.
   */
  async isCustomTabFilter(): Promise<boolean> {
    return this.page.locator('.conditions-custom-tab').isVisible({ timeout: 3000 }).catch(() => false);
  }

  /**
   * Select a service filter value.
   * @param value One of: 'All' | 'NHS' | 'Private'
   */
  async selectServiceFilter(value: 'All' | 'NHS' | 'Private') {
    if (await this.isCustomTabFilter()) {
      await this._selectCustomTabFilter(value);
    } else {
      await this._selectAntFilter(value);
    }
    // Let the filter apply
    await this.page.waitForTimeout(500);
  }

  private async _selectCustomTabFilter(value: 'All' | 'NHS' | 'Private') {
    const labelMap: Record<string, string> = {
      All: 'All',
      NHS: 'NHS Services',
      Private: 'Private Services',
    };
    const label = labelMap[value];
    await this.page.locator('.conditions-custom-tab').locator(`button:has-text("${label}")`).click();
  }

  private async _selectAntFilter(value: 'All' | 'NHS' | 'Private') {
    const selector = this.page.locator('.filter-select, .sorting-dropdown').first();
    await selector.click();

    const dropdown = this.page.locator('.ant-select-dropdown').filter({ hasNotText: 'display: none' }).last();
    await dropdown.waitFor({ state: 'visible', timeout: 5000 });

    if (value === 'All') {
      // Try clicking "All" option first, fallback to clear button
      const allOption = dropdown.locator('.ant-select-item-option-content').filter({ hasText: /^All$/i });
      if (await allOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await allOption.click();
        return;
      }
      await this.page.keyboard.press('Escape');
      const clearBtn = selector.locator('.ant-select-clear');
      if (await clearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await clearBtn.click();
      }
      return;
    }

    const optionTextMap: Record<string, RegExp> = {
      NHS: /NHS/i,
      Private: /Private/i,
    };
    await dropdown.locator('.ant-select-item-option-content').filter({ hasText: optionTextMap[value] }).click();
  }

  async clearServiceFilter() {
    await this.selectServiceFilter('All');
  }

  async getSelectedFilterText(): Promise<string> {
    if (await this.isCustomTabFilter()) {
      // Look for active tab — Tailwind active states vary but one button will be visually distinct
      const container = this.page.locator('.conditions-custom-tab');
      const buttons = await container.locator('button').all();
      for (const btn of buttons) {
        const classes = await btn.getAttribute('class') ?? '';
        const ariaSel = await btn.getAttribute('aria-selected');
        if (classes.includes('active') || classes.includes('bg-scheme') || ariaSel === 'true') {
          return (await btn.innerText()).trim();
        }
      }
      // Fallback: try data-active
      const active = container.locator('[data-active="true"]');
      if (await active.isVisible({ timeout: 1000 }).catch(() => false)) {
        return (await active.innerText()).trim();
      }
      return '';
    }

    const selector = this.page.locator('.filter-select, .sorting-dropdown').first();
    const selected = selector.locator('.ant-select-selection-item');
    return (await selected.innerText({ timeout: 3000 }).catch(() => '')).trim();
  }
}
