const EmailPage = require("../models/EmailPage");

// CREATE EMAIL REQUEST
exports.createEmailPage = async (req, res) => {
    try {
        console.log("========== EMAIL REQUEST ==========");
        console.log("User:", req.user?.id);
        console.log("Body:", req.body);
        console.log("===================================");

        const {
            domain,
            username,
            email,
            quota,
            purpose,
        } = req.body;

        if (!domain) {
            return res.status(400).json({
                success: false,
                message: "Domain is required",
            });
        }

        if (!username) {
            return res.status(400).json({
                success: false,
                message: "Email username is required",
            });
        }

        const emailAddress =
            email ||
            `${username}@${domain}`;

        const existing =
            await EmailPage.findOne({
                where: {
                    email: emailAddress,
                },
            });

        if (existing) {
            return res.status(409).json({
                success: false,
                message:
                    "This email request already exists.",
            });
        }

        const emailRequest =
            await EmailPage.create({
                userId: req.user?.id || null,
                domain,
                username,
                email: emailAddress,
                quota: Number(quota) || 5,
                purpose: purpose || "",
                status: "pending",
            });

        console.log(
            "✅ EMAIL REQUEST SAVED:",
            emailRequest.toJSON()
        );

        return res.status(201).json({
            success: true,
            message:
                "Email request submitted successfully",
            data: emailRequest,
        });

    } catch (err) {
        console.error(
            "❌ CREATE EMAIL REQUEST ERROR:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error:
                process.env.NODE_ENV === "development"
                    ? err.message
                    : undefined,
        });
    }
};


// GET ALL EMAIL REQUESTS
exports.getEmailPages = async (req, res) => {
    try {
        const requests =
            await EmailPage.findAll({
                order: [
                    ["createdAt", "DESC"],
                ],
            });

        return res.status(200).json({
            success: true,
            count: requests.length,
            data: requests,
        });

    } catch (err) {
        console.error(
            "❌ GET EMAIL REQUESTS ERROR:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
};


// DELETE EMAIL REQUEST
exports.deleteEmailPage = async (req, res) => {
    try {
        const { id } = req.params;

        const deleted =
            await EmailPage.destroy({
                where: { id },
            });

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message:
                    "Email request not found",
            });
        }

        return res.status(200).json({
            success: true,
            message:
                "Email request deleted successfully",
        });

    } catch (err) {
        console.error(
            "❌ DELETE EMAIL REQUEST ERROR:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
};