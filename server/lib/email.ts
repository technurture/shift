import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const BRAND_COLOR = "#7C3AED";
const BRAND_NAME = "MailSift";
const SUPPORT_EMAIL = "emailshift01@gmail.com";

function getEmailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${BRAND_NAME}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #5b21b6 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">${BRAND_NAME}</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Email Extraction Made Simple</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
                Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: ${BRAND_COLOR}; text-decoration: none;">${SUPPORT_EMAIL}</a>
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getButton(text: string, url?: string): string {
  const buttonStyle = `
    display: inline-block;
    background-color: ${BRAND_COLOR};
    color: #ffffff;
    padding: 14px 32px;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 16px;
    margin: 24px 0;
  `.replace(/\s+/g, " ").trim();

  if (url) {
    return `<a href="${url}" style="${buttonStyle}">${text}</a>`;
  }
  return `<span style="${buttonStyle}">${text}</span>`;
}

function getCodeBox(code: string): string {
  return `
    <div style="background-color: #f3f4f6; border: 2px dashed ${BRAND_COLOR}; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Your verification code:</p>
      <p style="margin: 0; font-size: 32px; font-weight: 700; color: ${BRAND_COLOR}; letter-spacing: 4px;">${code}</p>
    </div>
  `;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("SMTP credentials not configured. Email not sent.");
      return { success: false, error: "SMTP credentials not configured" };
    }

    await transporter.sendMail({
      from: `"${BRAND_NAME}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to send email" 
    };
  }
}

export async function sendVerificationEmail(
  email: string,
  code: string,
  firstName: string
): Promise<{ success: boolean; error?: string }> {
  const content = `
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 24px; font-weight: 600;">
      Verify Your Email Address
    </h2>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Hi ${firstName},
    </p>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Welcome to ${BRAND_NAME}! To complete your registration and start extracting emails, please verify your email address using the code below:
    </p>
    ${getCodeBox(code)}
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      This code will expire in <strong>15 minutes</strong>. If you didn't create an account with ${BRAND_NAME}, you can safely ignore this email.
    </p>
    <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
      Having trouble? Reply to this email and we'll help you out.
    </p>
  `;

  return sendEmail(email, `Verify your ${BRAND_NAME} account`, getEmailWrapper(content));
}

export async function sendWelcomeEmail(
  email: string,
  firstName: string,
  plan: string
): Promise<{ success: boolean; error?: string }> {
  const planDisplay = plan.charAt(0).toUpperCase() + plan.slice(1);
  const content = `
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 24px; font-weight: 600;">
      Welcome to ${BRAND_NAME}!
    </h2>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Hi ${firstName},
    </p>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Congratulations! Your email has been verified and your account is now active. You're on the <strong style="color: ${BRAND_COLOR};">${planDisplay}</strong> plan.
    </p>
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 18px; font-weight: 600;">
        What you can do with ${BRAND_NAME}:
      </h3>
      <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 15px; line-height: 1.8;">
        <li>Extract emails from any website URL</li>
        <li>Download your email lists in CSV format</li>
        <li>Track your extraction history</li>
        <li>Access your dashboard anytime</li>
      </ul>
    </div>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Ready to get started? Head over to your dashboard and paste your first URL!
    </p>
    <div style="text-align: center;">
      ${getButton("Go to Dashboard")}
    </div>
    <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
      If you have any questions, feel free to reach out to our support team.
    </p>
  `;

  return sendEmail(email, `Welcome to ${BRAND_NAME}, ${firstName}!`, getEmailWrapper(content));
}

export async function sendPasswordResetEmail(
  email: string,
  code: string,
  firstName: string
): Promise<{ success: boolean; error?: string }> {
  const content = `
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 24px; font-weight: 600;">
      Reset Your Password
    </h2>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Hi ${firstName},
    </p>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      We received a request to reset the password for your ${BRAND_NAME} account. Use the code below to reset your password:
    </p>
    ${getCodeBox(code)}
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      This code will expire in <strong>15 minutes</strong>. If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.
    </p>
    <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        <strong>Security tip:</strong> Never share this code with anyone. ${BRAND_NAME} will never ask for your verification code.
      </p>
    </div>
    <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
      If you didn't request this password reset, you can safely ignore this email.
    </p>
  `;

  return sendEmail(email, `Reset your ${BRAND_NAME} password`, getEmailWrapper(content));
}

export async function sendPlanUpgradeEmail(
  email: string,
  firstName: string,
  newPlan: string
): Promise<{ success: boolean; error?: string }> {
  const planDisplay = newPlan.charAt(0).toUpperCase() + newPlan.slice(1);
  
  const planFeatures: Record<string, string[]> = {
    starter: [
      "Up to 500 emails per month",
      "5 concurrent extractions",
      "CSV export",
      "Email support"
    ],
    professional: [
      "Up to 5,000 emails per month",
      "Unlimited concurrent extractions",
      "CSV & Excel export",
      "Priority email support",
      "API access"
    ],
    enterprise: [
      "Unlimited emails",
      "Unlimited concurrent extractions",
      "All export formats",
      "24/7 priority support",
      "Full API access",
      "Dedicated account manager",
      "Custom integrations"
    ]
  };

  const features = planFeatures[newPlan.toLowerCase()] || [
    "All features included in your plan",
    "Enhanced extraction limits",
    "Priority support"
  ];

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 24px; font-weight: 600;">
      Your Plan Has Been Upgraded!
    </h2>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Hi ${firstName},
    </p>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Great news! Your ${BRAND_NAME} account has been upgraded to the <strong style="color: ${BRAND_COLOR};">${planDisplay}</strong> plan. Thank you for your trust in us!
    </p>
    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 24px; margin: 24px 0; border: 1px solid #86efac;">
      <h3 style="margin: 0 0 16px 0; color: #166534; font-size: 18px; font-weight: 600;">
        Your ${planDisplay} Plan Features:
      </h3>
      <ul style="margin: 0; padding-left: 20px; color: #15803d; font-size: 15px; line-height: 1.8;">
        ${features.map(feature => `<li>${feature}</li>`).join("\n        ")}
      </ul>
    </div>
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Your new features are active immediately. Start exploring everything your new plan has to offer!
    </p>
    <div style="text-align: center;">
      ${getButton("Explore Your Dashboard")}
    </div>
    <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
      Thank you for choosing ${BRAND_NAME}. We're excited to help you grow!
    </p>
  `;

  return sendEmail(email, `Your ${BRAND_NAME} account has been upgraded to ${planDisplay}!`, getEmailWrapper(content));
}

export async function sendContactEmail(
  name: string,
  email: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const content = `
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 24px; font-weight: 600;">
      New Contact Form Submission
    </h2>
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px; vertical-align: top;">
            <strong>From:</strong>
          </td>
          <td style="padding: 8px 0; color: #111827; font-size: 16px;">
            ${name}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; vertical-align: top;">
            <strong>Email:</strong>
          </td>
          <td style="padding: 8px 0; color: #111827; font-size: 16px;">
            <a href="mailto:${email}" style="color: ${BRAND_COLOR}; text-decoration: none;">${email}</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; vertical-align: top;">
            <strong>Date:</strong>
          </td>
          <td style="padding: 8px 0; color: #111827; font-size: 16px;">
            ${new Date().toLocaleString("en-US", { 
              weekday: "long", 
              year: "numeric", 
              month: "long", 
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })}
          </td>
        </tr>
      </table>
    </div>
    <div style="margin: 24px 0;">
      <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 16px; font-weight: 600;">
        Message:
      </h3>
      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
        <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">${message}</p>
      </div>
    </div>
    <div style="text-align: center; margin-top: 24px;">
      <a href="mailto:${email}" style="display: inline-block; background-color: ${BRAND_COLOR}; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Reply to ${name}
      </a>
    </div>
  `;

  return sendEmail(
    SUPPORT_EMAIL,
    `[${BRAND_NAME} Contact] New message from ${name}`,
    getEmailWrapper(content)
  );
}
