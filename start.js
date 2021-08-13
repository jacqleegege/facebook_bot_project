const puppeteer = require("puppeteer");
const CREDS = require('./creds')
const prompt = require('prompt-sync')();
const ObjectsToCsv = require('objects-to-csv')
const fs = require('fs');
const readline = require('readline');
const neatCsv = require('neat-csv');

const USERNAME_SELECTOR = '#email';
const PASSWORD_SELECTOR = '#pass';
const SUBMIT_SELECTOR = '[type="submit"]';
const SEARCH_SELECTOR = '[type="search"]';
const MESSAGE_BTN_SELECTOR = "//div[contains(text(),'Send Message')]";
const COMMUNITY_FILTER = '&filters=eyJjYXRlZ29yeTowIjoie1wibmFtZVwiOlwicGFnZXNfY2F0ZWdvcnlcIixcImFyZ3NcIjpcIjI2MTJcIn0ifQ%3D%3D';
const TEXTBOX_SELECTOR = 'div.notranslate._5rpu';
const CLOSE_CHAT_BTN_SELECTOR = '[aria-label="Close chat"][role="button"]';
const OK_BTN_SELECTOR = '[aria-label="OK"][role="button"]';
const FOLLOWERS_SELECTOR = 'div.rq0escxv.l9j0dhe7.du4w35lb.j83agx80.cbu4d94t.g5gj957u.d2edcug0.hpfvmrgz.rj1gh0hx.buofh1pr.o8rfisnq.p8fzw8mz.pcp91wgn.iuny7tx3.ipjc6fyt > div > div > span > span';
const COOKIES_SELECTOR = 'div._9o-r button:nth-child(2)';

function run() {
    // dom element selectors for login page
    const MESSAGE_TO_SEND = prompt("Enter message to send : ");
    console.log(`Message to send is ${MESSAGE_TO_SEND}.`);
    console.log("Would you like to send message now?");
    const SEND_MESSAGE = prompt("(No is for testing in case you wanna watch bot in action!!) (Y/N) ");
    console.log("Note: you'll need 2 files listing each university and societies respectively. Please make sure that all the words are capitalized, and one uni per line!");
    console.log("Additionally, please make sure that they are all in the same folder!");
    const UNI_NAME_FILE = prompt("Enter file name for list of universities : ");
    console.log(`Input file is ${UNI_NAME_FILE}.`);
    const SOC_NAME_FILE = prompt("Enter file name for types of societies : ");
    console.log(`Input file is ${SOC_NAME_FILE}.`);
    console.log("Note: if there hasn't been any response from the terminal, that means something is wrong! Please ctrl-C and restart!")

    var num_searches = 3;
    console.log("Please choose whether to produce all search results or only the first 3.");
    const searches = prompt("Would you like to add all search results? (Y/N) : ")

    return new Promise(async (resolve, reject) => {
    try {

    var browser =  await puppeteer.launch({headless:false});
    var page = await browser.newPage();
    await page.setDefaultNavigationTimeout(1000000);
    await page.setViewport({ width: 1000, height: 600 });
    const context = browser.defaultBrowserContext();
    await context.overridePermissions("https://www.facebook.com", ['notifications']);
    await page.goto("https://www.facebook.com");

    // //cookie problem
    // await page.waitForSelector(COOKIES_SELECTOR);
    // await page.click(COOKIES_SELECTOR);

    //logging in
    console.log("Logging in..");
    await page.waitForSelector(USERNAME_SELECTOR);
    await page.type(USERNAME_SELECTOR, CREDS.username);
    await page.type(PASSWORD_SELECTOR, CREDS.password);
    await page.click(SUBMIT_SELECTOR);
    await page.waitForTimeout(2000);
    await page.waitForNavigation();

    //array to store types of society to search for
    const socTypes = [];

    const fileStream2 = fs.createReadStream(SOC_NAME_FILE);

    const rl2 = readline.createInterface({
      input: fileStream2,
      crlfDelay: Infinity
    });

    for await (const SOC_NAME of rl2) {
      socTypes.push(SOC_NAME);
    }

    const fileStream = fs.createReadStream(UNI_NAME_FILE);

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    // Note: we use the crlfDelay option to recognize all instances of CR LF
    // ('\r\n') in input.txt as a single line break.
    //initial array to store data of communities searched
    const comsData = [];

    console.log("Starting to fill up comsList.csv!");
    for await (const UNI_NAME of rl) {
      // Each line in input.txt will be successively available here as `UNI_NAME`.
      for await (const SOC_NAME of socTypes) {

      //search uni name
      var society = UNI_NAME.concat(" ", SOC_NAME);
      await page.waitForSelector(SEARCH_SELECTOR);
      await page.click(SEARCH_SELECTOR);
      await page.type(SEARCH_SELECTOR, society);
      await page.waitForTimeout(600);

      await (await page.$(SEARCH_SELECTOR)).press('\n');

      //filter to pages of category 'community'
      //Pre: uni entered must be full caps not sure why though urgh
      await page.waitForNavigation();
      var pages = page.url().replace("top", "pages").concat(COMMUNITY_FILTER);
      page.goto(pages);

      //go to profile of first result
      await page.waitForNavigation();
      await page.waitForTimeout(600);

      //produces result of the search
      let communities = await page.evaluate(() => {
        let results = [];
        let items = document.querySelectorAll('div[role="article"]>div>div>div>div>div>div:nth-child(2)>div>div>h2>span>span>span>a');
        items.forEach((item) => {
          results.push({
            url:  item.getAttribute('href'),
            text: item.textContent,
          });
        });

        return results;
      })


      if (searches.toString().trim() === 'Y' || searches.toString().trim() === 'y'
          || num_searches > communities.length) {
        num_searches = communities.length;
      }

      //comsData contains name, followers, and url for each community
      for (var i = 0; i < num_searches; i++) {
        page.goto(communities[i].url);
        await page.waitForNavigation();
        await page.waitForSelector(FOLLOWERS_SELECTOR);
        let likes = await page.evaluate((FOLLOWERS_SELECTOR) => {
          let follows = document.querySelector(FOLLOWERS_SELECTOR).textContent;
          return follows;
        }, FOLLOWERS_SELECTOR);
        comsData.push({
          name: communities[i].text,
          likes: likes,
          url: communities[i].url,
        });
        console.log(communities[i].text + " added");
      }
    }
  }
  console.log(comsData);

  //output a csv file for comsData
  const csv = new ObjectsToCsv(comsData);
  await csv.toDisk('./comsList.csv', { append: true });
  console.log('comsList.csv has been filled(or produced if not already)');

    //todo: figure out a way to take coms as input
  const continuing = prompt("Would you like to continue? (Y/N): ");
  if (continuing.toString().trim() === 'N' || continuing.toString().trim() === 'n') {
    console.log("You can always type 'node message' if you want to immediately start messaging! :D");
    console.log ("Closing process, have a great day!!");
    browser.close();
    return;
  }
  const change = prompt("Would you like to make changes to the message list? (Y/N): ");
  if (change.toString().trim() === 'Y' || change.toString().trim() === 'y') {
    console.log("Note: when editing comsList.csv, please do not leave any empty line or space in between, or I'll crash!")
    const changed = prompt("Please make your changes now to comsList.csv and click enter to continue");
  }

  console.log("Messaging all the pages in file comsList.csv...");

  fs.readFile('./comsList.csv', async (err, data) => {
    if (err) {
      console.error(err)
      return
    }
    const communitiesToMessage = await neatCsv(data);
    if (SEND_MESSAGE.toString().trim() === 'N' || SEND_MESSAGE.toString().trim() === 'n') {
      console.log("Well not actually messaging, but ya know ;)");
    }
    for (var i = 0; i < communitiesToMessage.length; i++) {
      await page.goto(communitiesToMessage[i].url);


      //click on message button
      // await page.click(MESSAGE_BTN_SELECTOR);
      await page.evaluate((MESSAGE_BTN_SELECTOR) => {
        var messageElement = document.evaluate(MESSAGE_BTN_SELECTOR, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        messageElement.click();
    }, MESSAGE_BTN_SELECTOR)

      await page.waitForSelector(TEXTBOX_SELECTOR);
      await page.type(TEXTBOX_SELECTOR, MESSAGE_TO_SEND);

      if (SEND_MESSAGE.toString().trim() === 'N' || SEND_MESSAGE.toString().trim() === 'n') {
        await page.click(CLOSE_CHAT_BTN_SELECTOR);
        await page.waitForSelector(OK_BTN_SELECTOR);
        await page.click(OK_BTN_SELECTOR);
      } else {
        await (await page.$(TEXTBOX_SELECTOR)).press('\n');
        await page.click(CLOSE_CHAT_BTN_SELECTOR);
      }

      console.log(communitiesToMessage[i].name + " messaged!");

    }

    console.log("Messaging process completed! Have a nice day :)")
    await browser.close();
  })


  } catch(e) {
  return reject(e);
  }
  })

}

run().then(console.log).catch(console.error);
