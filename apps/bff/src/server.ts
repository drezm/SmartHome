import { env } from "./config/env.js";
import { createRuntimeApp } from "./app.js";

const app = await createRuntimeApp();

app.listen(env.BFF_PORT, () => {
  console.log(`Smart Flow BFF is running on http://localhost:${env.BFF_PORT}`);
});
