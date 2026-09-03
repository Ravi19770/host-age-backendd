const router = require("express").Router();
const controller = require("../controllers/email.controller");
const auth = require("../middleware/Auth");


// CREATE EMAIL REQUEST
router.post("/", auth, controller.createEmailPage);


// GET ALL EMAIL REQUESTS
router.get("/", auth, controller.getEmailPages);


// DELETE SPECIFIC EMAIL REQUEST
router.delete("/:id", auth, controller.deleteEmailPage);


module.exports = router;