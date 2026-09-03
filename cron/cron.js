const cron = require("node-cron");
const renewalJob = require("../jobs/renewal.job");

console.log("🚀 Cron file loaded");

cron.schedule("* * * * * *", async () => {
  console.log("Running Renewal Job...");

  try {
    await renewalJob();
  } catch (err) {
    console.error(err);
  }
});

console.log("✅ Renewal Cron Started");