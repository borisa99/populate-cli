#!/usr/bin/env node

import chalk from "chalk";
import inquirer from "inquirer";
import chalkAnimation from "chalk-animation";
import axios from "axios";
import { createSpinner } from "nanospinner";

// --------UTILS--------
const LOCALES = ["en", "es", "fr", "mx"];
const requiredValidator = async (input) =>
  input ? true : "This input is required";

// --------------------

// --------WELCOME--------
let apiEndpoint;
let contentTitle;
let localeFrom;
let localeTo;

async function welcome() {
  const pulseTitle = chalkAnimation.pulse(
    "Do you want to populate rest of the languages in content? \n"
  );

  pulseTitle.stop();

  console.log(`
    ${chalk.bgBlue("HOW IT WORKS")} 
    1.Enter API endpoint.
    2.Enter content title.
    3.Enter language from which other will be populated.
    4.Enter which language you want to populate.
    5.Review and confirm 
    Let the CLI do the ${chalk.bgGreen("magic")}
  `);
}
// --------------------

// --------QUESTIONS--------
async function askAPIEndpoint() {
  const answer = await inquirer.prompt({
    name: "api_endpoint",
    type: "input",
    message: "Api Endpoint",
    default: "http://localhost:1337/api",
    validate: requiredValidator,
  });

  apiEndpoint = answer.api_endpoint;
}
async function askContentTitle() {
  const answer = await inquirer.prompt({
    name: "content_title",
    type: "input",
    message: "Content title",
    validate: requiredValidator,
  });

  contentTitle = answer.content_title;
}

async function askLocaleFrom() {
  const answer = await inquirer.prompt({
    name: "locale_from",
    type: "list",
    message: "Locale from",
    choices: LOCALES,
    validate: requiredValidator,
  });
  localeFrom = answer.locale_from;
}
async function askLocaleTo() {
  const filteredLocales = LOCALES.filter((locale) => locale !== localeFrom);
  const answer = await inquirer.prompt({
    name: "locale_to",
    type: "list",
    message: "Locales to",
    choices: filteredLocales,
  });

  localeTo = answer.locale_to;
}

async function askConfirm() {
  const answer = await inquirer.prompt({
    name: "confirm",
    type: "confirm",
    message: "Confirm?",
  });

  if (!answer.confirm) process.exit(0);

  return handleConfirm();
}

// --------------------

async function handleConfirm() {
  const spinner = createSpinner("Filling out choosen languages... \n").start();
  const axiosInstance = axios.create({
    baseURL: apiEndpoint + `/${contentTitle}`,
  });

  const res = await axiosInstance.get(
    `?locale=${localeFrom}&pagination[page]=1&pagination[pageSize]=1000`
  );
  const getPromises = [];
  res.data.data.map((resItem) => {
    const code = resItem.attributes.code;
    getPromises.push(
      axiosInstance.get(`?locale=${localeTo}&filters[code][$eq]=${code}`)
    );
  });

  if (getPromises.length === 0) {
    spinner.success({ text: "No entries found" });
    process.exit(0);
  }
  const createPromises = [];
  const results = await Promise.allSettled(getPromises);

  const invalidResults = results.filter(
    (result) => result.status !== "fulfilled"
  );
  if (invalidResults.length > 0) {
    spinner.error({ text: `Error while fetching: ${contentTitle}` });
    process.exit(1);
  }

  results.forEach((result) => {
    const url = result.value.config.url;
    const data = result.value.data.data;

    const locale = url.split("=")[1].substring(0, 2);
    const code = url.split("=")[2];

    const entry = res.data.data.find((item) => item.attributes.code === code);

    if (data && data.length > 0) {
      return;
    } else {
      createPromises.push(
        axiosInstance.post(`/${entry.id}/localizations`, {
          code: entry.attributes.code,
          locale,
        })
      );
    }
  });

  const insertResults = await Promise.allSettled(createPromises);

  const invalidInsertResults = insertResults.filter(
    (result) => result.status !== "fulfilled"
  );

  if (invalidInsertResults.length > 0) {
    spinner.error({
      text: `Error while inserting: ${contentTitle}, ${JSON.stringify({
        response: insertResults[0].reason?.response?.data,
        url:
          insertResults[0].reason?.config?.baseURL +
          insertResults[0].reason?.config?.url,
        data: insertResults[0].reason?.config?.data,
      })}`,
    });
    process.exit(1);
  } else {
    spinner.success({ text: "Success" });
    process.exit(0);
  }
}

console.clear();
await welcome();
await askAPIEndpoint();
await askContentTitle();
await askLocaleFrom();
await askLocaleTo();
await askConfirm();
