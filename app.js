require("dotenv").config();
const puppeteer = require("puppeteer");
const $ = require("cheerio");
const express = require("express");
const cron = require("node-cron");
const path = require("path");
const exphbs = require("express-handlebars");

let SCOM = 0;
let KCB = 0;
let EQTY = 0;

let TSCOM = 28;
let TKCB = 0;
let TEQTY = 32;

let task = null;

const app = express();

app.engine(".hbs", exphbs({ extname: ".hbs" }));
app.set("view engine", ".hbs");

const sendSms = (message) => {
  const credentials = {
    apiKey: process.env.AFRICASTALKING_API_KEY, // use your sandbox app API key for development in the test environment
    username: process.env.AFRICASTALKING_USERNAME, // use 'sandbox' for development in the test environment
  };
  const AfricasTalking = require("africastalking")(credentials);

  // Initialize a service e.g. SMS
  const sms = AfricasTalking.SMS;

  // Use the service
  const options = {
    to: ["+254727683173", "+254748824945"],
    message,
  };

  // Send message and capture the response or error
  sms
    .send(options)
    .then((response) => {
      console.log(`sms sent: ${message}`);
    })
    .catch((error) => {
      console.log(`sms failed: ${message}`);
      console.error(error);
    });
};

const getPrice = async (company) => {
  let browser;
  try {
    const url = `https://live.mystocks.co.ke/stock=${company}`;
    browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, {
      waitUntil: "networkidle2",
    });
    const html = await page.content();

    const price = parseFloat($("#rtPrice", html).text());
    console.log(company, price);

    await browser.close();
    return price;
  } catch (e) {
    console.error(e);
    await browser.close();
  }
};

const restartCron = () => {
  if (task) {
    task.destroy();
  }
  task = cron.schedule("*/20 * * * *", async () => {
    console.log("Cron started " + new Date());
    const scom = await getPrice("SCOM");
    const kcb = await getPrice("KCB");
    const eqty = await getPrice("EQTY");

    if (scom !== SCOM) {
      const temp = SCOM;
      SCOM = scom;
      if (SCOM > TSCOM) {
        sendSms(
          `Safaricom stock is at ${SCOM}. It has hit threshold: ${TSCOM}. Last recorded stock was ${temp}`
        );
      }
    }

    if (kcb !== KCB) {
      const temp = KCB;
      KCB = kcb;
      if (KCB > TKCB) {
        sendSms(
          `KCB stock is at ${KCB}. It has hit threshold: ${TKCB}. Last recorded stock was ${temp}`
        );
      }
    }

    if (eqty !== EQTY) {
      const temp = EQTY;
      EQTY = eqty;
      if (EQTY > TEQTY) {
        sendSms(
          `Equity stock is at ${EQTY}. It has hit threshold: ${TEQTY}. Last recorded stock was ${temp}`
        );
      }
    }
    console.log("Cron completed " + new Date());
  });
  task.start();
};

// restartCron();

// (async () => {
//   await getPrice("SCOM");
//   await getPrice("KCB");
//   await getPrice("EQTY");
// })();

app.get("/init", async (req, res) => {
  SCOM = parseFloat(req.query.SCOM) || SCOM;
  KCB = parseFloat(req.query.KCB) || KCB;
  EQTY = parseFloat(req.query.SCOM) || EQTY;

  TSCOM = parseFloat(req.query.TSCOM) || TSCOM;
  TKCB = parseFloat(req.query.TKCB) || TKCB;
  TEQTY = parseFloat(req.query.SCOM) || TEQTY;

  console.log("Safaricom threshold", TSCOM);
  console.log("KCB threshold", TKCB);
  console.log("Equity threshold", TEQTY);
  console.log("\n");
  console.log("Safaricom", SCOM);
  console.log("KCB", KCB);
  console.log("Equity", EQTY);

  restartCron();
  res.redirect("/");
});

app.get("/update", (req, res) => {
  res.render("update");
});

app.get("/", (req, res) => {
  res.render("home", { SCOM, EQTY, KCB, TSCOM, TEQTY, TKCB });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("App has started");
});
