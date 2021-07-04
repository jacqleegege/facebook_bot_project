const puppeteer = require("puppeteer");
const CREDS = require('./creds')

function run() {
    // dom element selectors for login page
   const USERNAME_SELECTOR = '#email';
   const PASSWORD_SELECTOR = '#pass';
   const SUBMIT_SELECTOR = '[type="submit"]';
   const SEARCH_SELECTOR = '[type="search"]';
   const UNI_NAME = 'Stanford';
   const PAGES = '[aria-current="page"]';

   return new Promise(async (resolve, reject) => {
     try {
        const browser =  await puppeteer.launch({headless:false});
        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(1000000);
        await page.setViewport({ width: 1000, height: 600 });
        const context = browser.defaultBrowserContext();
        await context.overridePermissions("https://www.facebook.com", ['notifications']);
        await page.goto("https://www.facebook.com");

        //logging in
        await page.waitForSelector(USERNAME_SELECTOR);
        await page.type(USERNAME_SELECTOR, CREDS.username);
        await page.type(PASSWORD_SELECTOR, CREDS.password);
        await page.click(SUBMIT_SELECTOR);
        await page.waitForTimeout(2000);
        await page.waitForNavigation();

        //search uni name
        await page.waitForSelector(SEARCH_SELECTOR);
        await page.click(SEARCH_SELECTOR);
        await page.type(SEARCH_SELECTOR, UNI_NAME);
        await page.waitForTimeout(2000);

        await (await page.$(SEARCH_SELECTOR)).press('\n');

        //filter to pages
        //Pre: uni entered must be full caps not sure why though urgh
        await page.waitForNavigation();
        var pages = page.url().replace("top", "pages");
        page.goto(pages);

        //go to profile of first result
        await page.waitForNavigation();
        let firstCom = await page.evaluate(() => {
          let item = document.querySelector('div[role="article"]>div>div>div>div>div>div:nth-child(2)>div>div>h2>span>span>span>a');
          let url = item.getAttribute('href');
          return url;
        })
        page.goto(firstCom);
        await page.waitForNavigation();

        //click on message button
        let messagee = await page.evaluate(() => {
          let message = document.querySelector('[aria-label="Message"][role="button"]');
          message.click();
          let att = message.getAttribute('role');
          return message;
        })

        // const messagebtn = await page.$x("//div[@aria-label='Message']");
        // await page.waitForTimeout(600);
        // messagebtn[0].click();
        // await page.click('[aria-label="Like"][role="button"]');
        // await page.click('[aria-label="Message"][role="button"]');
        // await page.$eval('[aria-label="Message"]', elem => elem.click());
        await page.waitForTimeout(2000);
        return resolve();

      } catch(e) {
        return reject(e);
      }
    })

}

run().then(console.log).catch(console.error);
