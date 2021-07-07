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

function message() {

  return new Promise(async (resolve, reject) => {
  try {

    console.log('Messages will be sent to communities listed in comsList.csv!');
    console.log('Note : If comsLIst.csv is not created yet, please exit this code by ctrl-C, and type node start');
    const wait = prompt('Click on any button to continue! If comsList.csv is not finalized yet, now is your chance :D');


    const MESSAGE_TO_SEND = prompt("Enter message to send : ");
    console.log(`Message to send is ${MESSAGE_TO_SEND}`);

    var browser =  await puppeteer.launch({headless:true});
    var page = await browser.newPage();
    await page.setDefaultNavigationTimeout(1000000);
    await page.setViewport({ width: 1000, height: 600 });
    const context = browser.defaultBrowserContext();
    await context.overridePermissions("https://www.facebook.com", ['notifications']);
    await page.goto("https://www.facebook.com");


    //logging in
    console.log('Logging in..');
    await page.waitForSelector(USERNAME_SELECTOR);
    await page.type(USERNAME_SELECTOR, CREDS.username);
    await page.type(PASSWORD_SELECTOR, CREDS.password);
    await page.click(SUBMIT_SELECTOR);
    await page.waitForTimeout(2000);
    await page.waitForNavigation();

    console.log('Starting messaging process to communities listed in comsList.csv!');

    fs.readFile('./comsList.csv', async (err, data) => {
      if (err) {
        console.error(err);
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
        }, MESSAGE_BTN_SELECTOR);

        await page.waitForSelector(TEXTBOX_SELECTOR);
        await page.type(TEXTBOX_SELECTOR, MESSAGE_TO_SEND);

        // the dangerous 'send button'
        // await (await page.$(TEXTBOX_SELECTOR)).press('\n');

        await page.click(CLOSE_CHAT_BTN_SELECTOR);
        await page.waitForSelector(OK_BTN_SELECTOR);
        await page.click(OK_BTN_SELECTOR);
      }
      console.log("Messaging process completed! Have a nice day :)")
      console.log("Closing browser..")
      await browser.close();
    })



  } catch(e) {
      return reject(e);
  }
  })
}

message().then(console.log).catch(console.error);
