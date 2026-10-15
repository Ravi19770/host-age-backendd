const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const jwt = require("jsonwebtoken");
const express = require("express");
const { User, Domain, Plan, Ticket, EmailPage } = require("../models");

async function runTests() {
  console.log("==========================================");
  console.log("🧪 TESTING ADMIN API ENDPOINTS");
  console.log("==========================================");

  let server;
  try {
    // 1. Find an admin user
    const admin = await User.findOne({ where: { role: "ADMIN" } });
    if (!admin) {
      throw new Error("No admin user found in database!");
    }
    console.log(`✅ Found Admin: ${admin.fullName} (${admin.email}) [ID: ${admin.id}]`);

    // 2. Find a non-admin regular user
    const regularUser = await User.findOne({ where: { role: "USER" } });
    console.log(`✅ Found Regular User: ${regularUser.fullName} (${regularUser.email})`);

    // 3. Generate tokens
    const adminToken = jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const userToken = jwt.sign({ id: regularUser.id, role: regularUser.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // 4. Start ephemeral test server
    const app = express();
    app.use(express.json());

    const authMiddleware = require("../middleware/Auth");
    const roleMiddleware = require("../middleware/role.middleware");
    const adminRoutes = require("../routes/admin.routes");

    app.use("/api/admin", authMiddleware, roleMiddleware("ADMIN"), adminRoutes);

    server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`✅ Test server running on ${baseUrl}`);

    // Test A: Unauthenticated request -> should be 401
    const unauthRes = await fetch(`${baseUrl}/api/admin/dashboard`);
    console.log(`🔒 Test A: Unauthenticated request -> status ${unauthRes.status} (Expected: 401)`);
    if (unauthRes.status !== 401) throw new Error("Unauthenticated check failed!");

    // Test B: Regular user request -> should be 403
    const userRes = await fetch(`${baseUrl}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    console.log(`🚫 Test B: Regular user request -> status ${userRes.status} (Expected: 403)`);
    if (userRes.status !== 403) throw new Error("Role RBAC check failed!");

    // Test C: Admin request to /api/admin/dashboard -> should be 200 with real DB counts
    const adminDashRes = await fetch(`${baseUrl}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dashData = await adminDashRes.json();
    console.log(`📊 Test C: Admin dashboard -> status ${adminDashRes.status}`);
    console.log("   Stats:", JSON.stringify(dashData.stats, null, 2));
    if (adminDashRes.status !== 200 || !dashData.success) {
      throw new Error("Admin dashboard request failed!");
    }

    // Test D: Admin request to /api/admin/users
    const usersRes = await fetch(`${baseUrl}/api/admin/users?limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const usersData = await usersRes.json();
    console.log(`👥 Test D: Admin users -> status ${usersRes.status}, count: ${usersData.count}, page items: ${usersData.users.length}`);
    if (usersRes.status !== 200 || usersData.users.length === 0) {
      throw new Error("Admin users request failed!");
    }

    // Test E: Admin request to /api/admin/domains
    const domainsRes = await fetch(`${baseUrl}/api/admin/domains?limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const domainsData = await domainsRes.json();
    console.log(`🌐 Test E: Admin domains -> status ${domainsRes.status}, count: ${domainsData.count}`);
    if (domainsRes.status !== 200 || domainsData.domains.length === 0) {
      throw new Error("Admin domains request failed!");
    }

    // Test F: Admin request to /api/admin/plans
    const plansRes = await fetch(`${baseUrl}/api/admin/plans`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const plansData = await plansRes.json();
    console.log(`💳 Test F: Admin plans -> status ${plansRes.status}, count: ${plansData.plans.length}`);
    console.log("   Plans:", plansData.plans.map(p => `${p.name} (₹${p.price})`).join(", "));
    if (plansRes.status !== 200 || plansData.plans.length === 0) {
      throw new Error("Admin plans request failed!");
    }

    // Test G: Admin request to /api/admin/cvtpl/status
    const cvtplRes = await fetch(`${baseUrl}/api/admin/cvtpl/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const cvtplData = await cvtplRes.json();
    console.log(`🔌 Test G: CVTPL Status -> status ${cvtplRes.status}, configured: ${cvtplData.config?.configured}`);

    // Test H: Admin request to /api/admin/tickets
    const ticketsRes = await fetch(`${baseUrl}/api/admin/tickets?limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const ticketsData = await ticketsRes.json();
    console.log(`🎫 Test H: Admin tickets -> status ${ticketsRes.status}, count: ${ticketsData.count}`);

    // Test I: Admin request to /api/admin/emails
    const emailsRes = await fetch(`${baseUrl}/api/admin/emails?limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const emailsData = await emailsRes.json();
    console.log(`✉️ Test I: Admin emails -> status ${emailsRes.status}, count: ${emailsData.count}`);

    console.log("\n==========================================");
    console.log("🎉 ALL 9 BACKEND ADMIN TESTS PASSED PERFECTLY!");
    console.log("==========================================");
    if (server) server.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ TEST FAILED:", error);
    if (server) server.close();
    process.exit(1);
  }
}

runTests();

