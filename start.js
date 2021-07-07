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
const FOLLOWERS_SELECTOR = 'div.taijpn5t.cbu4d94t.j83agx80 > div > div > div > div.rq0escxv.l9j0dhe7.du4w35lb.j83agx80.cbu4d94t.g5gj957u.d2edcug0.hpfvmrgz.rj1gh0hx.buofh1pr.o8rfisnq.p8fzw8mz.pcp91wgn.iuny7tx3.ipjc6fyt > div > div > span > span';


function run() {
    // dom element selectors for login page
    const MESSAGE_TO_SEND = prompt("Enter message to send : ");
    console.log(`Message to send is ${MESSAGE_TO_SEND}.`);
    console.log("Note: you'll need an input file listing each university. Please make sure that all the words are capitalized, and one uni per line!");
    const INPUT_FILE = prompt("Enter file name (please make sure that file is in the folder!) : ");
    console.log(`Input file is ${INPUT_FILE}.`);
    console.log("Note: if there hasn't been any response from the terminal, that means something is wrong! Please ctrl-C and restart!")


    return new Promise(async (resolve, reject) => {
    try {

    var browser =  await puppeteer.launch({headless:true});
    var page = await browser.newPage();
    await page.setDefaultNavigationTimeout(1000000);
    await page.setViewport({ width: 1000, height: 600 });
    const context = browser.defaultBrowserContext();
    await context.overridePermissions("https://www.facebook.com", ['notifications']);
    await page.goto("https://www.facebook.com");


    //logging in
    console.log("Logging in..");
    await page.waitForSelector(USERNAME_SELECTOR);
    await page.type(USERNAME_SELECTOR, CREDS.username);
    await page.type(PASSWORD_SELECTOR, CREDS.password);
    await page.click(SUBMIT_SELECTOR);
    await page.waitForTimeout(2000);
    await page.waitForNavigation();


    const fileStream = fs.createReadStream(INPUT_FILE);

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
      // Each line in input.txt will be successively available here as `line`.

    //search uni name
    await page.waitForSelector(SEARCH_SELECTOR);
    await page.click(SEARCH_SELECTOR);
    await page.type(SEARCH_SELECTOR, UNI_NAME);
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
    //TODO: improve to include everything when scroll down
    let communities = await page.evaluate(() => {
      let results = [];
      let items = document.querySelectorAll('div[role="article"]>div>div>div>div>div>div:nth-child(2)>div>div>h2>span>span>span>a');
      items.forEach((item) => {
        results.push({
          url:  item.getAttribute('href'),
          text: item.textContent,
        });
      });
      results.shift();

      return results;
    })

    //comsData contains name, followers, and url for each community
    for (var i = 0; i < communities.length; i++) {
      page.goto(communities[i].url);
      await page.waitForNavigation();
      let followers = await page.evaluate((FOLLOWERS_SELECTOR) => {
        let follows = document.querySelector(FOLLOWERS_SELECTOR).textContent;
        return follows;
      }, FOLLOWERS_SELECTOR);
      comsData.push({
        name: communities[i].text,
        followers: followers,
        url: communities[i].url,
      });
      console.log(communities[i].text + " added");
    }

  }
  console.log(comsData);

  //output a csv file for comsData
  const csv = new ObjectsToCsv(comsData);
  await csv.toDisk('./comsList.csv', { append: true });
  console.log('comsList.csv has been filled(or produced if not already)');

    //todo: figure out a way to take coms as input
  const continuing = prompt("Would you like to continue? (Y/N): ");
  if (continuing.toString().trim() === 'N') {
    console.log("You can always type 'node message' if you want to immediately start messaging! :D");
    console.log ("Closing process, have a great day!!");
    browser.close();
    return;
  }
  const change = prompt("Would you like to make changes to the message list? (Y/N): ");
  if (change.toString().trim() === 'Y') {
    console.log("Note: when editing comsList.csv, please do not leave any empty line or space in between, or I'll crash!")
    const changed = prompt("Please make your changes now to comsList.csv and click any button to continue");
  }

  console.log("Messaging all the pages in file comsList.csv...");

  fs.readFile('./comsList.csv', async (err, data) => {
    if (err) {
      console.error(err)
      return
    }
    const communitiesToMessage = await neatCsv(data);
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

      // the dangerous 'send button'
      // await (await page.$(TEXTBOX_SELECTOR)).press('\n');

      await page.click(CLOSE_CHAT_BTN_SELECTOR);
      await page.waitForSelector(OK_BTN_SELECTOR);
      await page.click(OK_BTN_SELECTOR);
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
