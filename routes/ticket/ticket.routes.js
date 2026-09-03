const express = require("express");

const router = express.Router();

const ticketController = require("../../controllers/ticket/ticket.controller");

const auth = require("../../middleware/Auth");

const upload = require("../../middleware/upload.js");


console.log("✅ ticket.routes.js loaded");
// Customer Routes
router.post(
  "/",
  auth,
  upload.any(),
  (req, res, next) => {
    console.log("FILES:", req.files);
    console.log("BODY:", req.body);
    next();
  },
  ticketController.createTicket
);

router.get(
    "/",
    auth,
    ticketController.getTickets
);

router.get(
    "/:id",
    auth,
    ticketController.getTicket
);

router.post(
    "/:id/reply",
    auth,
    ticketController.replyTicket
);

// Admin Routes
router.put(
    "/:id",
    auth,
    ticketController.updateTicket
);

router.put(
    "/:id/assign",
    auth,
    ticketController.assignAgent
);

router.post(
    "/:id/internal-note",
    auth,
    ticketController.addInternalNote
);

router.delete(
    "/:id",
    auth,
    ticketController.deleteTicket
);


module.exports = router;