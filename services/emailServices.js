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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light">
        <title>Verify Your Email | Host-Age</title>
      </head>
      <body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#101010;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
          <tr><td align="center" style="padding:28px 12px 30px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">


   <!-- HOST-AGE BRAND -->
<tr>
  <td align="center" style="padding:10px 10px 54px;">
    <a href="https://host-age.in" style="text-decoration:none;display:inline-block;">
      <img
        src="https://host-age.in/assets/images/Host-Age%20logo.png"
        alt="Host-Age Logo"
        width="220"
        style="display:block;width:220px;max-width:100%;height:auto;border:0;margin:0 auto;"
      />
    </a>
  </td>
</tr>
              <!-- MAIN BLUE PANEL -->
              <tr><td style="padding:28px 22px 25px;background:#eaf5ff;background-image:linear-gradient(180deg,#d9edff 0%,#edf7ff 72%,#ffffff 100%);border-radius:22px 22px 0 0;">
                <p style="margin:22px 0 18px;font-size:16px;letter-spacing:3px;color:#0068c9;">VERIFICATION CODE</p>
                <h1 style="margin:0 0 18px;font-size:32px;line-height:1.2;color:#142f5b;">Verify Your<br><span style="color:#2176d2;">Email Address</span></h1>
                <p style="margin:0 0 28px;font-size:15px;line-height:1.55;color:#111111;">Use the verification code below to complete your sign in and secure your account.</p>

                <!-- Decorative server illustration made with email-safe tables -->
                <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 28px;">
                  <tr><td align="center" style="padding:0 0 0 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#bfe5ff;border-radius:40px 40px 26px 26px;">
                      <tr><td style="padding:15px 16px 8px;">
                        <table role="presentation" cellpadding="0" cellspacing="5" border="0" style="background:#1975c9;border-radius:9px;padding:5px;box-shadow:0 5px 0 #0c4c91;">
                          <tr><td style="width:82px;height:19px;background:#163f70;border-radius:5px;border:1px solid #6cbcff;"></td><td style="width:32px;background:#102f56;border-radius:5px;text-align:center;color:#38d9ff;font-size:12px;">●●●</td></tr>
                          <tr><td style="height:19px;background:#163f70;border-radius:5px;border:1px solid #6cbcff;"></td><td style="background:#102f56;border-radius:5px;text-align:center;color:#38d9ff;font-size:12px;">●●●</td></tr>
                          <tr><td style="height:19px;background:#163f70;border-radius:5px;border:1px solid #6cbcff;"></td><td style="background:#102f56;border-radius:5px;text-align:center;color:#38d9ff;font-size:12px;">●●●</td></tr>
                        </table>
                      </td></tr>
                      <tr><td align="center" style="padding:0 0 12px;font-size:12px;color:#1763a8;font-weight:bold;">SECURE CLOUD HOSTING</td></tr>
                    </table>
                  </td></tr>
                </table>

                <!-- OTP CARD -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:15px;">
                  <tr><td align="center" style="padding:32px 12px;">
                    <p style="margin:0 0 22px;color:#4b6e9d;font-size:14px;font-weight:bold;letter-spacing:3px;">YOUR VERIFICATION CODE</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="background:#eaf3ff;border-radius:14px;padding:8px 12px;">
                      <span style="font-size:clamp(32px,8vw,54px);line-height:1.35;font-weight:bold;letter-spacing:5px;color:#17396d;white-space:nowrap;">${cleanOtp.split("").join(" ")}</span>
                    </td></tr></table>
                    <p style="margin:28px 0 0;color:#111111;font-size:14px;line-height:1.6;">This code is valid for <strong>10 minutes.</strong></p>
                  </td></tr>
                </table>
              </td></tr>

              <!-- HOW TO USE -->
              <tr><td style="padding:30px 25px 25px;">
                <h2 style="margin:0 0 34px;font-size:28px;line-height:1.25;color:#080808;">How to Use This Code</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td width="62" valign="top" style="padding:0 0 27px;"><div style="width:48px;height:48px;line-height:48px;text-align:center;background:#deedff;border-radius:50%;color:#0755a0;font-size:24px;font-weight:bold;">1</div></td><td valign="middle" style="padding:0 0 27px;font-size:16px;line-height:1.5;">Go back to the <strong>Host-Age</strong> website or app.</td></tr>
                  <tr><td width="62" valign="top" style="padding:0 0 27px;"><div style="width:48px;height:48px;line-height:48px;text-align:center;background:#deedff;border-radius:50%;color:#0755a0;font-size:24px;font-weight:bold;">2</div></td><td valign="middle" style="padding:0 0 27px;font-size:16px;line-height:1.5;">Enter the 6-digit code in the verification field.</td></tr>
                  <tr><td width="62" valign="top"><div style="width:48px;height:48px;line-height:48px;text-align:center;background:#deedff;border-radius:50%;color:#0755a0;font-size:24px;font-weight:bold;">3</div></td><td valign="middle" style="font-size:16px;line-height:1.5;">Complete your sign in.</td></tr>
                </table>
              </td></tr>

              
<!-- SECURITY CARD -->
<tr>
  <td style="padding:15px 0;">
    <table role="presentation" width="100%" cellpadding="0"
           cellspacing="0" border="0"
           style="background:#edf5ff;border-radius:16px;">
      <tr>
        <td width="105" align="center" valign="middle"
            style="padding:22px 10px;">
          <div style="width:76px;height:76px;line-height:76px;
                      text-align:center;background:#ffffff;
                      border-radius:50%;">
            <img
              src="YOUR_PUBLIC_URL/Untitled%20design%20(8).svg"
              alt="Secure Lock"
              width="42"
              height="42"
              style="display:inline-block;width:42px;height:42px;
                     border:0;vertical-align:middle;"
            />
          </div>
        </td>

        <td valign="middle" style="padding:22px 15px 22px 5px;">
          <h3 style="margin:0 0 10px;font-size:16px;color:#07396f;">
            Keep Your Account Secure
          </h3>
          <p style="margin:0;color:#111111;font-size:13px;line-height:1.5;">
            Do not share this code with anyone. Our team will never ask
            for your verification code.
          </p>
        </td>
      </tr>
    </table>
  </td>
</tr>

<!-- SUPPORT CARD -->
<tr>
  <td style="padding:15px 0 30px;">
    <table role="presentation" width="100%" cellpadding="0"
           cellspacing="0" border="0"
           style="background:#edf5ff;border-radius:16px;">
      <tr>
        <td width="105" align="center" valign="top"
            style="padding:25px 10px;">
          <div style="width:76px;height:76px;line-height:76px;
                      text-align:center;background:#ffffff;
                      border-radius:50%;">
            <img
              src="YOUR_PUBLIC_URL/Untitled%20design%20(9).svg"
              alt="Chat Support"
              width="42"
              height="42"
              style="display:inline-block;width:42px;height:42px;
                     border:0;vertical-align:middle;"
            />
          </div>
        </td>

        <td valign="top" style="padding:27px 15px 25px 5px;">
          <h3 style="margin:0 0 12px;font-size:16px;color:#07396f;">
            Need Help?
          </h3>

          <p style="margin:0 0 16px;color:#111111;font-size:13px;line-height:1.5;">
            If you didn't request this code or are having trouble
            verifying your email, our support team is here to help.
          </p>

          <a href="https://host-age.in"
             target="_blank"
             style="display:inline-block;background:#0751a0;
                    color:#ffffff;text-decoration:none;font-weight:bold;
                    font-size:14px;padding:11px 25px;border-radius:24px;">
            Chat Support &rarr;
          </a>
        </td>
      </tr>
    </table>
  </td>
</tr>


              <!-- SERVICE BENEFITS -->
              <tr><td style="padding:15px 0 28px;border-top:1px solid #cccccc;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td align="center" width="25%" style="padding:25px 2px 0;"><div style="width:62px;height:62px;line-height:62px;border-radius:50%;background:#e2efff;font-size:29px;">&#9729;</div><p style="margin:14px 0 0;font-size:13px;line-height:1.4;">Reliable<br>Hosting</p></td>
                  <td align="center" width="25%" style="padding:25px 2px 0;"><div style="width:62px;height:62px;line-height:62px;border-radius:50%;background:#e2efff;font-size:29px;">&#10004;</div><p style="margin:14px 0 0;font-size:13px;line-height:1.4;">Secure<br>Infrastructure</p></td>
                  <td align="center" width="25%" style="padding:25px 2px 0;"><div style="width:62px;height:62px;line-height:62px;border-radius:50%;background:#e2efff;font-size:29px;">&#9889;</div><p style="margin:14px 0 0;font-size:13px;line-height:1.4;">High<br>Performance</p></td>
                  <td align="center" width="25%" style="padding:25px 2px 0;"><div style="width:62px;height:62px;line-height:62px;border-radius:50%;background:#e2efff;font-size:29px;">&#9881;</div><p style="margin:14px 0 0;font-size:13px;line-height:1.4;">Expert<br>Support</p></td>
                </tr></table>
              </td></tr>

              <!-- FOOTER -->
              

<tr>
  <td align="center"
      style="background:#142f5b;border-radius:22px;padding:28px 20px;color:#ffffff;">

    <p style="margin:0 0 20px;font-size:13px;line-height:1.8;color:#ffffff;">
      Follow us on social media
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0"
           border="0" align="center">
      <tr>
        <!-- Instagram: Untitled design (16).svg -->
        <td align="center" style="padding:0 12px;">
          <a href="YOUR_INSTAGRAM_PROFILE_URL" target="_blank">
            <img
              src="YOUR_PUBLIC_URL/Untitled%20design%20(16).svg"
              alt="Instagram"
              width="32"
              height="32"
              style="display:block;width:32px;height:32px;border:0;"
            />
          </a>
        </td>

        <!-- Facebook: Untitled design (17).svg -->
        <td align="center" style="padding:0 12px;">
          <a href="YOUR_FACEBOOK_PAGE_URL" target="_blank">
            <img
              src="YOUR_PUBLIC_URL/Untitled%20design%20(17).svg"
              alt="Facebook"
              width="32"
              height="32"
              style="display:block;width:32px;height:32px;border:0;"
            />
          </a>
        </td>

        <!-- YouTube: Untitled design (18).svg -->
        <td align="center" style="padding:0 12px;">
          <a href="YOUR_YOUTUBE_CHANNEL_URL" target="_blank">
            <img
              src="YOUR_PUBLIC_URL/Untitled%20design%20(18).svg"
              alt="YouTube"
              width="32"
              height="32"
              style="display:block;width:32px;height:32px;border:0;"
            />
          </a>
        </td>
      </tr>
    </table>
  </td>
</tr>


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
