import express from "express";
import { itemsToTrack } from "./itemsList.js";
import { chromium } from "playwright";
import nodemailer from "nodemailer";
import * as dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = 3001;
const password = process.env.EMAIL_PASS;

// map over each item and get an array with all id's
const urls = itemsToTrack.map((item) => {
  const id = item.id;
  return `https://www.amazon.co.uk/dp/${id}`;
});
console.log(urls);

/**
 * a fn that goes to each url and check the price of the product, using playwright to go to the webpage and get details
 * @returns results (title, price and url)
 * and call the sendEmail fn, the results will be sent if the price has dropped under the amount specified
 */
async function checkPrices() {
  // open a chromium browser
  const browser = await chromium.launch({
    headless: false, // show the browser
  });
  const desiredPrice = 150;
  const results = [];

  for (let url of urls) {
    // open a new page / tab in the browser
    const page = await browser.newPage();
    // tell the page to navigate to url
    await page.goto(url);

    //use the $eval method to extract the products' title and price from the page
    const [title, price] = await page.$eval("#title", (titleEl) => {
      const title = titleEl.innerText;
      // turns the string into a number
      const price = parseFloat(
        document.querySelector(".a-price-whole").innerText.replace(",", "")
      );
      return [title, price];
    });

    if (price < desiredPrice) {
      results.push(
        `The price for ${title} had DROPPED. The CURRENT PRICE IS: £${price}. If you want to buy ${url}.`
      );
    }
    await page.waitForTimeout(500);
  }
  await browser.close();

  // concatenates all the elements of the results array into a single string separated by a newline character
  if (results.length > 0) {
    await sendEmail(results.join("\n"));
  }
  return results;
}

/**
 * a fn that will send an email using nodemailer
 */
async function sendEmail(results) {
  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "beatrice.stanila@gmail.com",
      pass: password,
    },
  });

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: "beatrice.stanila@gmail.com", // sender address
    to: "beatrice.stanila@gmail.com", // list of receivers
    subject: "Gym Bench Price Checker",
    text: results,
  });

  console.log("Message sent: %s", info.messageId);
}

// get the results on home page
app.get("/", async (req, res) => {
  try {
    const result = await checkPrices();
    return res.status(200).json({
      result: result,
    });
  } catch (err) {
    return res.status(500).json({
      err: err.toString(),
    });
  }
});

app.listen(PORT, function () {
  console.log(`Server is listening on port ${PORT}`);
});
