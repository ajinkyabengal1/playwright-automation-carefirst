import { test } from "@playwright/test";
import { TEST_USER } from "../fixtures/test-data";
import { FLOW_CONFIGS } from "../fixtures/flow-configs";
import { runConditionFlow } from "../helpers/run-flow";

const nhsFlows = FLOW_CONFIGS.filter((c) => c.conditionJourneyType === "nhs");

test.describe("NHS Condition Flows", () => {
  for (const config of nhsFlows) {
    test(config.name, async ({ page, baseURL }) => {
      page.on("console", (msg) => {
        if (msg.type() === "error" || msg.type() === "warning") {
          console.log(`[browser ${msg.type()}] ${msg.text()}`);
        }
      });
      page.on("pageerror", (err) => console.log(`[page error] ${err.message}`));
      page.on("response", (res) => {
        if (res.status() >= 400) console.log(`[HTTP ${res.status()}] ${res.url()}`);
      });

      await runConditionFlow(page, config, TEST_USER, baseURL);
    });
  }
});
