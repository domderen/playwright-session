# Playwright-Session

[Playwright-Session UI](https://playwright-session.hotdata.co/) visualizes a recorded Playwright session in a UI containing:

- Video from the session, 
- DOM HTML Viewer,
- Network Requests Viewer,
- Console Viewer,
- Playwright actions listed in console view to easily understand what your script was doing,

![Playwright-Session in action](https://playwright-session.hotdata.co/Playwright-Session-UI-Small.gif)


## Recording Session

To record your own Playwright session, start by adding this package to your project:

```bash
npm install playwright-session --save-dev
```

Once you have the package installed, you need to initialize your playwright script with the recorder:

```javascript
import { chromium } from 'playwright';
import initializeRecorder from 'playwright-session';

(async () => {
  const browser = await chromium.launch();
  
  // Recorder is initalizing required events collection,
  // to later be able to replay a Playwright session in the UI.
  // Session file, that can be loaded in the UI,
  // will be saved to ./vuetify-session-events.ldjson
  const { page, context } = await initializeRecorder(
    browser,
    'vuetify-session-events'
  );

  await page.goto('https://vuetifyjs.com/en/');
  
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

  await page.click('#usage h2');

  // Adding timeouts here, to show down Playwright,
  // and make recorded session a bit smoother.
  await new Promise(r => setTimeout(r, 1000));

  await inputs[0].fill("Welcome");
  await new Promise(r => setTimeout(r, 500));
  await inputs[1].fill("To");
  await new Promise(r => setTimeout(r, 500));
  await inputs[2].fill("Playwright-Session");

  await new Promise(r => setTimeout(r, 3000));

  await browser.close();
})();
```

## Replaying Session

Once you have your session file recorded, head over to the [Playwright-Session UI](https://playwright-session.hotdata.co/), upload your session file by clicking on the Upload button in the top-left corner of the UI, and play your session.

## API

```typescript
/**
 * Bootstraps session recording on top of the open browser connection.
 * Session recording will be saved to a file defined by `sessionFilePath` argument.
 * Once bootstrapped, this function will return a new BrowserContext & Page.
 * @param browser ChromiumBrowser Browser instance.
 * @param [sessionFilePath] [OPTIONAL] Path where session recoeding file should be saved.
 * Defaults to `${process.cwd()}/playwright-session-events-${new Date().toISOString()}.ldjson`.
 * @param contextOpts [OPTIONAL] Options that can be passed to `browser.newContext` call, used when creating new BrowserContext.
 */
export default async function initializeRecorder(
  browser: ChromiumBrowser,
  sessionFilePath: string = undefined,
  contextOpts: any = undefined
): Promise<InitializeRecorderResponse>

/**
 * Recorder is extending browser methods, and returns both page & context objects for further modifications.
 */
type InitializeRecorderResponse = {
  page: Page,
  context: ChromiumBrowserContext
};
```
