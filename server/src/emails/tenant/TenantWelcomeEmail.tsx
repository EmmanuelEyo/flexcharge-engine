import React from "react";
import {
  Html,
  Body,
  Head,
  Heading,
  Container,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface TenantWelcomeEmailProps {
  tenantName: string;
}

export function TenantWelcomeEmail({
  tenantName,
}: TenantWelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to FlexCharge, {tenantName}!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to FlexCharge! ⚡</Heading>
          <Text style={text}>Hi {tenantName},</Text>
          <Text style={text}>
            Thank you for creating your FlexCharge developer account. We're excited to help you manage recurring subscriptions and credit wallets on top of Nomba!
          </Text>
          <Section style={section}>
            <Text style={text}>
              <strong>Next Steps to Get Started:</strong>
            </Text>
            <Text style={text}>
              1. 🔑 Generate your API keys in the <strong>Developers</strong> tab of your Merchant Dashboard.
            </Text>
            <Text style={text}>
              2. 🏦 Configure your payout settlement bank account to receive withdrawals.
            </Text>
            <Text style={text}>
              3. 📦 Create your first subscription plan and try the public checkout.
            </Text>
          </Section>
          <Text style={text}>
            If you need any help integrating our APIs, please consult the official developer documentation or contact support.
          </Text>
          <Text style={footer}>
            Powered by FlexCharge Inc. &copy; {new Date().getFullYear()}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};
const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
};
const h1 = {
  color: "#4f46e5", // indigo-600
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "40px",
  margin: "0 0 20px",
};
const text = {
  color: "#333",
  fontSize: "16px",
  lineHeight: "24px",
};
const section = {
  padding: "24px",
  backgroundColor: "#f5f3ff", // indigo-50
  border: "1px solid #ddd6fe",
  borderRadius: "5px",
  margin: "24px 0",
};
const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
};

export default TenantWelcomeEmail;
