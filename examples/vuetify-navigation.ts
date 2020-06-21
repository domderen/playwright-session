import { chromium } from "playwright";
import initializeRecorder from "../src/playwright-session";

(async () => {
  const browser = await chromium.launch();

  // Recorder is initalizing required events collection, to later be able to replay a Playwright session in the UI.
  // Session file, that can be loaded in the UI, will be saved to ./vuetify-session-events.ldjson
  const { page } = await initializeRecorder(browser, "vuetify-session-events");

  await page.goto("https://vuetifyjs.com/en/");

  await page.evaluate(() => console.log("Adding sample console log 1"));
  await page.evaluate(() => console.warn("Adding sample console log 2"));
  await page.evaluate(() => console.info("Adding sample console log 3"));
  await page.evaluate(() => console.error("Adding sample console log 4"));
  await page.evaluate(() => console.debug("Adding sample console log 5"));

  await page.click('a[href="/en/getting-started/quick-start/"]');

  await page.click('text="UI Components"');

  await page.click('text="Form inputs & controls"');

  await page.click('text="Forms"');

  await page.waitForSelector('#usage .v-example input[type="text"]');

  const inputs = await page.$$('#usage .v-example input[type="text"]');

  await page.click("#usage h2");

  // Adding timeouts here, to show down Playwright, and make recorded session a bit smoother.
  await new Promise((r) => setTimeout(r, 1000));

  await inputs[0].fill("Welcome");
  await new Promise((r) => setTimeout(r, 500));
  await inputs[1].fill("To");
  await new Promise((r) => setTimeout(r, 500));
  await inputs[2].fill("Playwright-Session");

  await new Promise((r) => setTimeout(r, 3000));

  await browser.close();
})();
