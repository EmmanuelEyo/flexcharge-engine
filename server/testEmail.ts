import { sendEmail } from "./src/services/email.service.js";
import { WelcomeEmail } from "./src/emails/customer/WelcomeEmail.js";
import React from "react";

async function run() {
  console.log("Starting email test...");
  
  const element = React.createElement(WelcomeEmail, {
    customerName: "Test User",
    planName: "Pro Plan",
    amount: "NGN 5000",
    interval: "monthly",
    tenantName: "Acme Corp",
  });

  // Sending to petermmuo05@gmail.com
  const success = await sendEmail("petermmuo05@gmail.com", "Test Subject", element);
  
  if (success) {
    console.log("✅ Email dispatched successfully (check terminal logs for Pino output)");
  } else {
    console.log("❌ Email failed to dispatch. Make sure RESEND_API_KEY is correctly set in .env.");
  }
}

run();
