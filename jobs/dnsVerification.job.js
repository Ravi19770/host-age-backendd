const cron = require("node-cron");
const {
  recheckPendingDomains,
} = require("../services/dnsVerification.service");

let task = null;
let running = false;

function startDnsVerificationJob() {
  // Prevent duplicate cron schedules.
  if (task) {
    console.log("DNS recheck job is already scheduled");
    return;
  }

  task = cron.schedule("*/15 * * * *", async () => {
    if (running) return;

    running = true;

    try {
      await recheckPendingDomains();
    } catch (error) {
      console.error("Scheduled DNS recheck failed:", error.message);
    } finally {
      running = false;
    }
  });

  console.log("DNS recheck job scheduled every 15 minutes");
}

function stopDnsVerificationJob() {
  if (task) {
    task.stop();
    task = null;
    console.log("DNS recheck job stopped");
  }
}

module.exports = {
  startDnsVerificationJob,
  stopDnsVerificationJob,
};