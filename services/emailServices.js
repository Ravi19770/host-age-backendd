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
      subject: "Verify your email address | Host-Age",

      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport"
              content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light">
        <title>Verify your email - Host-Age</title>
      </head>

      <body style="
        margin:0;
        padding:0;
        background-color:#f1f5f9;
        font-family:Arial,Helvetica,sans-serif;
        color:#0f172a;
      ">

        <table role="presentation" width="100%"
          cellpadding="0" cellspacing="0"
          style="background:#f1f5f9;padding:32px 12px;">
          <tr>
            <td align="center">

              <table role="presentation" width="100%"
                cellpadding="0" cellspacing="0"
                style="
                  max-width:560px;
                  background:#ffffff;
                  border:1px solid #e2e8f0;
                  border-radius:14px;
                  overflow:hidden;
                ">

                <!-- BRAND HEADER -->
                <tr>
                  <td align="center" style="padding:30px 24px 24px;">
                    <div style="
                      display:inline-block;
                      background:#2563eb;
                      color:#ffffff;
                      padding:10px 14px;
                      border-radius:10px;
                      font-size:20px;
                      font-weight:bold;
                      letter-spacing:-0.5px;
                    ">
                      Host-Age
                    </div>

                    <p style="
                      margin:12px 0 0;
                      color:#64748b;
                      font-size:11px;
                      letter-spacing:1.5px;
                    ">
                      HOSTING · DOMAINS · BUSINESS EMAIL
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 32px;">
                    <div style="height:1px;background:#e2e8f0;"></div>
                  </td>
                </tr>

                <!-- MAIN CONTENT -->
                <tr>
                  <td style="padding:32px 32px 20px;">

                    <div style="
                      width:52px;
                      height:52px;
                      line-height:52px;
                      text-align:center;
                      background:#eff6ff;
                      border-radius:14px;
                      color:#2563eb;
                      font-size:25px;
                      font-weight:bold;
                    ">
                      ✓
                    </div>

                    <h1 style="
                      margin:24px 0 14px;
                      font-size:27px;
                      line-height:1.3;
                      letter-spacing:-0.6px;
                      color:#0f172a;
                    ">
                      Verify your email address
                    </h1>

                    <p style="
                      margin:0 0 16px;
                      font-size:15px;
                      line-height:1.8;
                      color:#475569;
                    ">
                      Hello there,
                    </p>

                    <p style="
                      margin:0 0 24px;
                      font-size:15px;
                      line-height:1.8;
                      color:#475569;
                    ">
                      Welcome to Host-Age! Use the verification
                      code below to confirm your email address
                      and continue setting up your account.
                    </p>

                    <!-- OTP CARD -->
                    <table role="presentation" width="100%"
                      cellpadding="0" cellspacing="0"
                      style="
                        background:#f8fafc;
                        border:1px solid #dbeafe;
                        border-radius:12px;
                      ">
                      <tr>
                        <td align="center" style="padding:24px 16px;">

                          <p style="
                            margin:0 0 14px;
                            color:#64748b;
                            font-size:11px;
                            font-weight:bold;
                            letter-spacing:1.5px;
                          ">
                            YOUR VERIFICATION CODE
                          </p>

                          <p style="
                            margin:0;
                            color:#2563eb;
                            font-size:34px;
                            line-height:1.4;
                            font-weight:bold;
                            letter-spacing:8px;
                            font-family:Arial,Helvetica,sans-serif;
                          ">
                            ${cleanOtp}
                          </p>

                          <p style="
                            margin:14px 0 0;
                            color:#64748b;
                            font-size:13px;
                          ">
                            This code expires in 10 minutes.
                          </p>

                        </td>
                      </tr>
                    </table>

                    <!-- SECURITY NOTICE -->
                    <table role="presentation" width="100%"
                      cellpadding="0" cellspacing="0"
                      style="margin-top:24px;">
                      <tr>
                        <td width="30" valign="top"
                          style="color:#2563eb;font-size:18px;">
                          &#128274;
                        </td>
                        <td style="
                          color:#475569;
                          font-size:13px;
                          line-height:1.8;
                        ">
                          <strong style="color:#0f172a;">
                            Keep your code secure.
                          </strong>
                          Never share this code with anyone.
                          Host-Age will never ask you to disclose
                          your verification code over the phone.
                        </td>
                      </tr>
                    </table>

                    <p style="
                      margin:26px 0 0;
                      color:#64748b;
                      font-size:13px;
                      line-height:1.8;
                    ">
                      Didn't request this verification?
                      You can safely ignore this email.
                      Your account will not be verified using
                      this email alone.
                    </p>

                  </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                  <td style="
                    padding:24px 20px;
                    background:#f8fafc;
                    border-top:1px solid #e2e8f0;
                    text-align:center;
                  ">
                    <p style="
                      margin:0 0 8px;
                      color:#334155;
                      font-size:13px;
                      font-weight:bold;
                    ">
                      Host-Age
                    </p>

                    <p style="
                      margin:0 0 12px;
                      color:#64748b;
                      font-size:12px;
                      line-height:1.7;
                    ">
                      Secure hosting. Professional email.
                    </p>

                    <a href="https://host-age.in"
                      style="
                        color:#2563eb;
                        font-size:12px;
                        text-decoration:none;
                      ">
                      www.host-age.in
                    </a>

                    <p style="
                      margin:16px 0 0;
                      color:#94a3b8;
                      font-size:11px;
                    ">
                      © 2026 Host-Age. All rights reserved.
                    </p>
                  </td>
                </tr>

              </table>

              <p style="
                margin:18px 0 0;
                color:#94a3b8;
                font-size:11px;
                text-align:center;
                line-height:1.7;
              ">
                This is an automated message.
                Please do not reply to this email.
              </p>

            </td>
          </tr>
        </table>

      </body>
      </html>
      `,

      text: `
Host-Age - Verify your email address

Hello there,

Welcome to Host-Age!

Your email verification code is: ${cleanOtp}

This code expires in 10 minutes.

Never share this code with anyone.

If you did not request this verification,
you can safely ignore this email.

Host-Age
https://host-age.in
      `,
    });

    if (error) {
      console.error("Resend OTP Email Error:", error);
      throw new Error(error.message || "Failed to send OTP email");
    }

    console.log("OTP email sent successfully.");
    console.log("Resend Email ID:", data?.id);

    return data;
  } catch (err) {
    console.error("Resend OTP Error:", err.message);
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