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

export interface SubscriptionResumedEmailProps {
  customerName: string;
  tenantName: string;
  planName: string;
}

export function SubscriptionResumedEmail({
  customerName,
  tenantName,
  planName,
}: SubscriptionResumedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your subscription with {tenantName} has been resumed</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Subscription Resumed</Heading>
          <Text style={text}>Hi {customerName},</Text>
          <Text style={text}>
            Great news! Your subscription to <strong>{planName}</strong> with <strong>{tenantName}</strong> has been successfully resumed and is now active.
          </Text>
          <Section style={section}>
            <Text style={text}>
              Automated renewal charges and subscription access have been restored. No manual action is required from you.
            </Text>
          </Section>
          <Text style={text}>
            You can manage your payment details or view invoices at any time by logging into the customer portal.
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
  color: "#16a34a", // green-600
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
  backgroundColor: "#f0fdf4", // green-50
  border: "1px solid #bbf7d0",
  borderRadius: "5px",
  margin: "24px 0",
};
const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
};

export default SubscriptionResumedEmail;
