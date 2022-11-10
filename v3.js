#!/usr/bin/env node

import chalk from "chalk";
import inquirer from "inquirer";
import mysql from "mysql";
import chalkAnimation from "chalk-animation";
import { createSpinner } from "nanospinner";

// --------UTILS--------
const LOCALES = ["en", "es", "fr", "mx"];
const requiredValidator = async (input) =>
  input ? true : "This input is required";

const connection = mysql.createConnection({
  host: "localhost",
  port: 3306,
  user: "strapiadmin",
  password: "Strap!Adm!n",
  database: "wptg_strapi",
  ssl: false,
});
connection.connect();

// --------------------

// --------WELCOME--------
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
    ${chalk.bgBlue("Currently supporting only 'games' table")} 

    1.Enter language from which other will be populated.
    2.Enter which language you want to populate.
    3.Review and confirm 
    Let the CLI do the ${chalk.bgGreen("magic")}
  `);
}
// --------------------

// --------QUESTIONS--------

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
  let currentIndex = 0;
  let length = 0;
  connection.query(
    `SELECT * FROM games WHERE locale='${localeFrom}'`,
    function (allErr, dbResults) {
      if (allErr) {
        spinner.error(allErr.message);
        process.exit(1);
      }
      length = dbResults.length;
      if (length === 0) {
        spinner.success({ text: "No results found" });
        process.exit(0);
      }
      dbResults.forEach((game) => {
        connection.query(
          `SELECT * FROM ${contentTitle} WHERE code='${game.code}' AND locale='${localeTo}'`,
          function (singleErr, singleResult) {
            if (singleErr) {
              spinner.error(singleErr.message);
              process.exit(1);
            }
            if (singleResult.length === 0) {
              connection.query(
                `INSERT INTO ${contentTitle} (code, locale) VALUES ('${game.code}','${localeTo}');`,
                function (insertErr, insertResult) {
                  if (insertErr) {
                    spinner.error(insertErr.message);
                    process.exit(1);
                  }
                  connection.query(
                    `INSERT INTO ${contentTitle}_localizations_links(game_id, inv_game_id) VALUES ((SELECT id from ${contentTitle} WHERE code='${game.code}' AND locale='en' LIMIT 1) ,'${insertResult.insertId}'),('${insertResult.insertId}',(SELECT id from ${contentTitle} WHERE code='${game.code}' AND locale='en' LIMIT 1) );`,
                    function (insertLocaleErr, _) {
                      currentIndex++;

                      if (insertLocaleErr) {
                        spinner.error(insertLocaleErr.message);
                        process.exit(1);
                      }

                      if (currentIndex === length || currentIndex == length) {
                        spinner.success({ text: "Success" });
                        process.exit(0);
                      }
                    }
                  );
                }
              );
            } else {
              currentIndex++;

              if (currentIndex === length || currentIndex == length) {
                spinner.success({ text: "Success" });
                process.exit(0);
              }
            }
          }
        );
      });
    }
  );
}

console.clear();
await welcome();
await askLocaleFrom();
await askLocaleTo();
await askConfirm();
