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

export interface SubscriptionPausedEmailProps {
  customerName: string;
  tenantName: string;
  planName: string;
}

export function SubscriptionPausedEmail({
  customerName,
  tenantName,
  planName,
}: SubscriptionPausedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your subscription with {tenantName} has been paused</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={hpa}>Subscription Paused</Heading>
          <Text style={text}>Hi {customerName},</Text>
          <Text style={text}>
            Your subscription to <strong>{planName}</strong> with <strong>{tenantName}</strong> has been temporarily paused.
          </Text>
          <Section style={section}>
            <Text style={text}>
              While paused, you will not be charged for automatic renewals, and access to the subscription benefits may be restricted until the subscription is resumed.
            </Text>
          </Section>
          <Text style={text}>
            If you have any questions or want to resume your service, please log in to your customer portal or contact support.
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
const hpa = {
  color: "#e11d48", // rose-600
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
  backgroundColor: "#fff1f2", // rose-50
  border: "1px solid #fecdd3",
  borderRadius: "5px",
  margin: "24px 0",
};
const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
};

export default SubscriptionPausedEmail;
