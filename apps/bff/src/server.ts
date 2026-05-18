import { env } from "./config/env.js";
import { createRuntimeApp } from "./app.js";
import type { HomeService } from "./services/homeService.js";

const app = await createRuntimeApp();
const home = app.locals.homeService as HomeService;
let automationRunning = false;

app.listen(env.BFF_PORT, () => {
  console.log(`Smart Flow BFF is running on http://localhost:${env.BFF_PORT}`);
});

setInterval(async () => {
  if (automationRunning) {
    return;
  }

  automationRunning = true;
  try {
    await home.runAutomationCycle();
  } catch (error) {
    console.error("Automation cycle failed", error);
  } finally {
    automationRunning = false;
  }
}, env.AUTOMATION_INTERVAL_MS);
