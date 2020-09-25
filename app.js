require("dotenv").config();
const puppeteer = require("puppeteer");
const $ = require("cheerio");
const express = require("express");
const cron = require("node-cron");
const path = require("path");
const exphbs = require("express-handlebars");

const { update, read } = require("./db");

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

  //Send message and capture the response or error
  sms
    .send(options)
    .then((response) => {
      console.log(`sms sent: ${message}`);
    })
    .catch((error) => {
      console.log(`sms failed: ${message}`);
      console.error(error);
    });
  // console.log(message);
};

const getPrice = async (company) => {
  let browser;
  try {
    const url = `https://live.mystocks.co.ke/stock=${company}`;
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
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
    try {
      await browser.close();
    } catch (e) {
      console.error(e);
    }
  }
};

const restartCron = () => {
  if (task) {
    task.destroy();
  }
  task = cron.schedule("*/5 * * * *", async () => {
    console.log("Cron started " + new Date());
    const scom = await getPrice("SCOM");
    const kcb = await getPrice("KCB");
    const eqty = await getPrice("EQTY");

    const SCOM = await read("SCOM/current");
    const KCB = await read("KCB/current");
    const EQTY = await read("EQTY/current");

    const TSCOM = await read("SCOM/threshold");
    const TKCB = await read("KCB/threshold");
    const TEQTY = await read("EQTY/threshold");

    if (scom !== SCOM) {
      // update db
      await update("SCOM/current", scom);

      if (scom > TSCOM) {
        sendSms(
          `Safaricom stock is at ${scom}. It has hit threshold: ${TSCOM}. Last recorded stock was ${SCOM}`
        );
      }
    }

    if (kcb !== KCB) {
      // update db
      await update("KCB/current", kcb);

      if (kcb > TKCB) {
        sendSms(
          `KCB stock is at ${kcb}. It has hit threshold: ${TKCB}. Last recorded stock was ${KCB}`
        );
      }
    }

    if (eqty !== EQTY) {
      // update db
      await update("EQTY/current", eqty);

      if (eqty > TEQTY) {
        sendSms(
          `Equity stock is at ${eqty}. It has hit threshold: ${TEQTY}. Last recorded stock was ${EQTY}`
        );
      }
    }
    console.log("Cron completed " + new Date());
  });
  task.start();
};

restartCron();

app.get("/init", async (req, res) => {
  const tscom = parseFloat(req.query.TSCOM);
  const tkcb = parseFloat(req.query.TKCB);
  const teqty = parseFloat(req.query.TEQTY);

  if (tscom) await update("SCOM/threshold", tscom);
  if (tkcb) await update("KCB/threshold", tkcb);
  if (teqty) await update("EQTY/threshold", teqty);

  console.log("Safaricom threshold", tscom);
  console.log("KCB threshold", tkcb);
  console.log("Equity threshold", teqty);

  restartCron();
  res.redirect("/");
});

const getStatus = async () => {
  const SCOM = await read("SCOM/current");
  const KCB = await read("KCB/current");
  const EQTY = await read("EQTY/current");

  const TSCOM = await read("SCOM/threshold");
  const TKCB = await read("KCB/threshold");
  const TEQTY = await read("EQTY/threshold");
  return { SCOM, EQTY, KCB, TSCOM, TEQTY, TKCB };
};

app.get("/update", async (req, res) => {
  res.render("update", await getStatus());
});

app.get("/", async (req, res) => {
  res.render("home", await getStatus());
});

app.listen(process.env.PORT || 3000, () => {
  console.log("App has started");
});
