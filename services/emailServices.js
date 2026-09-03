const { Resend } = require("resend");
const Domain = require("../models/domains/domains.model");

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "Host-Age <no-reply@host-age.in>";

console.log("📧 RESEND FROM_EMAIL =", JSON.stringify(FROM_EMAIL));
if (!process.env.RESEND_API_KEY) {
  console.error("❌ RESEND_API_KEY is missing");
} else {
  console.log("✅ Resend Initialized");
}

// ==========================
// OTP EMAIL
// ==========================
const sendOTPEmail = async (email, otp) => {
  try {
    if (!email || !otp) {
      throw new Error("Email and OTP are required");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    if (!/^\d{6}$/.test(cleanOtp)) {
      throw new Error("Invalid OTP format");
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: normalizedEmail,
      subject: "Host-Age Email Verification OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
          <h2>Host-Age Email Verification</h2>

          <div style="
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            margin: 25px 0;
          ">
            ${cleanOtp}
          </div>

          <p>This OTP is valid for <strong>10 minutes</strong>.</p>

          <p>
            If you did not request this OTP, you can safely ignore this email.
          </p>

          <hr />

          <p style="font-size: 12px; color: #666;">
            This is an automated email from Host-Age. Please do not reply.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("❌ OTP Email Error:", error);
      throw new Error(error.message || "Failed to send OTP email");
    }

    console.log("✅ OTP Email Sent Successfully");
    console.log("📧 Email ID:", data?.id);

    return data;
  } catch (err) {
    console.error("❌ Resend OTP Error:", err.message);
    throw err;
  }
};
// RESET PASSWORD EMAIL
// ==========================
const sendResetPasswordEmail = async (email, resetLink) => {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Reset Your Host-Age Password",
      html: `
        <h2>Reset Password</h2>

        <p>Click the button below to reset your password.</p>

        <a href="${resetLink}"
           style="
             display:inline-block;
             padding:12px 20px;
             background:#2563eb;
             color:#ffffff;
             text-decoration:none;
             border-radius:6px;">
          Reset Password
        </a>

        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    });

    if (error) {
      console.error("❌ Reset Email Error:", error);
      throw new Error(error.message);
    }

    console.log("✅ Reset Email Sent Successfully");
    console.log("📧 Email ID:", data.id);

    return data;
  } catch (err) {
    console.error("❌ Resend Reset Email Error:", err.message);
    throw err;
  }
};

//welcome email

const sendWelcomeEmail = async ({
  customerEmail,
  customerName,
  mailbox,
  mailboxPassword,
  domain,
}) => {
  return sendEmail({
    to: customerEmail,
    subject: "🎉 Welcome to Host-Age Email",

    html: `
    <div style="
      max-width:650px;
      margin:auto;
      font-family:Arial,sans-serif;
      border:1px solid #e5e7eb;
      border-radius:10px;
      overflow:hidden;
    ">

      <div style="
        background:#2563eb;
        color:#fff;
        padding:25px;
        text-align:center;
      ">
        <h1>Welcome to Host-Age</h1>
      </div>

      <div style="padding:30px;">

        <h2>Hello ${customerName},</h2>

        <p>Your professional email account has been created successfully.</p>

        <table style="
          width:100%;
          border-collapse:collapse;
          margin-top:20px;
        ">

          <tr>
            <td><strong>Email Address</strong></td>
            <td>${mailbox}</td>
          </tr>

          <tr>
            <td><strong>Password</strong></td>
            <td>${mailboxPassword}</td>
          </tr>

          <tr>
            <td><strong>Webmail</strong></td>
            <td>
              <a href="https://webmail.${domain}">
                https://webmail.${domain}
              </a>
            </td>
          </tr>

          <tr>
            <td><strong>Incoming (IMAP)</strong></td>
            <td>mail.${domain}:993 (SSL)</td>
          </tr>

          <tr>
            <td><strong>Outgoing (SMTP)</strong></td>
            <td>mail.${domain}:465 (SSL)</td>
          </tr>

        </table>

        <br>

        <p>
          Thank you for choosing <b>Host-Age</b>.
        </p>

      </div>

    </div>
    `,
  });
};




module.exports = {
  sendOTPEmail,
  sendResetPasswordEmail,
};