const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { Sequelize, QueryTypes } = require("sequelize");

// Use postgres superuser or fallback to DB_* credentials
const superuserSequelize = new Sequelize(
  process.env.DB_NAME || "Hostagedb",
  "postgres",
  process.env.DB_PASS || "Ravi@123456789123",
  {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 5432,
    dialect: "postgres",
    logging: false,
  }
);

async function runMigration() {
  console.log("==========================================");
  console.log("🚀 STARTING HOST-AGE ADMIN SAFE MIGRATION");
  console.log("==========================================");

  let seq = superuserSequelize;
  try {
    await seq.authenticate();
    console.log("✅ Connected as postgres superuser.");
  } catch (err) {
    console.warn("⚠️ Postgres superuser auth failed, trying app connection:", err.message);
    const { sequelize } = require("../config/db");
    seq = sequelize;
    await seq.authenticate();
  }

  try {
    // 1. Add `cvtpl` column to `domains`
    console.log("\n📦 Checking `domains` table schema...");
    const domainCols = await seq.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'domains' AND column_name = 'cvtpl'`,
      { type: QueryTypes.SELECT }
    );

    if (domainCols.length === 0) {
      console.log("➕ Adding column `cvtpl` (JSONB) to `domains` table...");
      await seq.query(`
        ALTER TABLE domains 
        ADD COLUMN cvtpl JSONB NOT NULL DEFAULT '{
          "provisioned": false,
          "status": "pending",
          "requestId": null,
          "cvtplDomainId": null,
          "dns": null,
          "lastError": null,
          "provisionedAt": null
        }'::jsonb;
      `);
      console.log("✅ Column `cvtpl` added to `domains`.");
    } else {
      console.log("✓ Column `cvtpl` already exists in `domains`.");
    }

    // 2. Check and create `plans` table
    console.log("\n📦 Checking `plans` table...");
    const planTable = await seq.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plans'`,
      { type: QueryTypes.SELECT }
    );

    if (planTable.length === 0) {
      console.log("➕ Creating `plans` table...");
      await seq.query(`
        CREATE TABLE plans (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(120) NOT NULL,
          price NUMERIC(10, 2) NOT NULL DEFAULT 0,
          billing_cycle VARCHAR(32) NOT NULL DEFAULT 'month',
          max_websites INTEGER NOT NULL DEFAULT 1,
          max_emails INTEGER NOT NULL DEFAULT 1,
          max_pages INTEGER NOT NULL DEFAULT 1,
          features JSONB NOT NULL DEFAULT '[]'::jsonb,
          is_active BOOLEAN NOT NULL DEFAULT true,
          is_featured BOOLEAN NOT NULL DEFAULT false,
          description TEXT,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `);
      console.log("✅ Table `plans` created.");

      // Seed initial plans
      console.log("🌱 Seeding default plans (FREE, PRO, PREMIUM)...");
      const defaultPlans = [
        {
          id: "free",
          name: "FREE HOST-AGE",
          price: 0,
          billing_cycle: "month",
          max_websites: 1,
          max_emails: 1,
          max_pages: 1,
          features: JSON.stringify([
            "1 Website",
            "1 Domain",
            "1 Email Account",
            "Free SSL",
            "24×7 Community Support",
            "No cPanel Access"
          ]),
          is_active: true,
          is_featured: false,
          description: "Ideal for getting started with zero hosting costs."
        },
        {
          id: "pro",
          name: "PRO HOST-AGE",
          price: 142,
          billing_cycle: "month",
          max_websites: 1,
          max_emails: 6,
          max_pages: 6,
          features: JSON.stringify([
            "1 Website",
            "6 Email Accounts",
            "6 Pages",
            "Free SSL",
            "Daily Backup",
            "Priority Support",
            "₹95 Additional Email",
            "₹192 Additional 1GB"
          ]),
          is_active: true,
          is_featured: true,
          description: "Best for professionals and expanding portfolios."
        },
        {
          id: "premium",
          name: "PREMIUM HOST-AGE",
          price: 179,
          billing_cycle: "month",
          max_websites: 1,
          max_emails: 15,
          max_pages: 12,
          features: JSON.stringify([
            "1 Website",
            "15 Email Accounts",
            "12 Pages",
            "Free SSL",
            "Daily Backup",
            "Premium 24×7 Support",
            "₹95 Additional Email",
            "₹192 Additional 1GB"
          ]),
          is_active: true,
          is_featured: false,
          description: "High-performance business hosting with generous limits."
        }
      ];

      for (const p of defaultPlans) {
        await seq.query(
          `INSERT INTO plans (id, name, price, billing_cycle, max_websites, max_emails, max_pages, features, is_active, is_featured, description, "createdAt", "updatedAt")
           VALUES (:id, :name, :price, :billing_cycle, :max_websites, :max_emails, :max_pages, :features::jsonb, :is_active, :is_featured, :description, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          { replacements: p }
        );
      }
      console.log("✅ Default plans seeded.");
    } else {
      console.log("✓ Table `plans` already exists.");
    }

    // 3. Check `audit_logs` table
    console.log("\n📦 Checking `audit_logs` table...");
    const auditCols = await seq.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'userId'`,
      { type: QueryTypes.SELECT }
    );
    if (auditCols.length === 0) {
      console.log("➕ Adding `userId` column to `audit_logs`...");
      await seq.query(`
        ALTER TABLE audit_logs ADD COLUMN "userId" VARCHAR(64);
      `);
      console.log("✅ Column `userId` added to `audit_logs`.");
    } else {
      console.log("✓ `audit_logs` has `userId` column.");
    }

    // Grant all privileges on all tables in public schema to DB_USER
    if (process.env.DB_USER) {
      console.log(`\n🔑 Granting permissions on tables to ${process.env.DB_USER}...`);
      await seq.query(`
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${process.env.DB_USER}";
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${process.env.DB_USER}";
      `);
      console.log("✅ Permissions granted.");
    }

    console.log("\n==========================================");
    console.log("🎉 MIGRATION COMPLETED SUCCESSFULLY!");
    console.log("==========================================");
    process.exit(0);
  } catch (error) {
    console.error("❌ MIGRATION ERROR:", error);
    process.exit(1);
  }
}

runMigration();

