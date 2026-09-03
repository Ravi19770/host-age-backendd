require("dotenv").config();

const bcrypt = require("bcryptjs");
const { connectDB, sequelize } = require("../config/db");
const User = require("../models/User");

const ADMINS = [
  {
    fullName:
      process.env.ADMIN1_NAME || "Host-Age Admin 1",

    email:
      (process.env.ADMIN1_EMAIL ||
        "admin1@host-age.in")
        .trim()
        .toLowerCase(),

    password:
      process.env.ADMIN1_PASSWORD ||
      "HostAge@Admin123!",
  },

  {
    fullName:
      process.env.ADMIN2_NAME || "Host-Age Admin 2",

    email:
      (process.env.ADMIN2_EMAIL ||
        "admin2@host-age.in")
        .trim()
        .toLowerCase(),

    password:
      process.env.ADMIN2_PASSWORD ||
      "HostAge@Admin456!",
  },
];

(async () => {
  try {
    console.log("🔄 Connecting to PostgreSQL...");

    await connectDB();

    console.log("✅ PostgreSQL Connected");

    // Make sure the current Sequelize model matches the DB.
    await sequelize.sync({ alter: true });

    for (const admin of ADMINS) {
      const existing = await User.findOne({
        where: {
          email: admin.email,
        },
      });

      if (existing) {
        // Do NOT overwrite the existing password.
        // Only make sure the account has ADMIN privileges
        // and is active/verified.
        await existing.update({
          fullName: admin.fullName,
          role: "ADMIN",
          isActive: true,
          emailVerified: true,
        });

        console.log(
          `✅ Existing admin verified: ${admin.email}`
        );
      } else {
        // IMPORTANT:
        // User model validates password length BEFORE
        // beforeCreate can hash it.
        //
        // Therefore hash it here first.
        const passwordHash = await bcrypt.hash(
          admin.password,
          12
        );

        await User.create({
          fullName: admin.fullName,
          email: admin.email,
          password: passwordHash,
          role: "ADMIN",
          isActive: true,
          emailVerified: true,
        });

        console.log(
          `✅ Admin created: ${admin.email}`
        );
      }
    }

    console.log(
      "=============================================="
    );

    console.log(
      "✅ Two Host-Age ADMIN accounts are ready."
    );

    console.log(
      "⚠️ Change the default passwords immediately if you keep the defaults."
    );

    console.log(
      "=============================================="
    );
  } catch (error) {
    console.error(
      "❌ ADMIN SEED FAILED:",
      error
    );

    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();