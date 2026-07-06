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

export interface TenantSubscriptionPausedEmailProps {
  tenantName: string;
  customerName: string;
  customerEmail: string;
  planName: string;
}

export function TenantSubscriptionPausedEmail({
  tenantName,
  customerName,
  customerEmail,
  planName,
}: TenantSubscriptionPausedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>A customer paused their subscription — FlexCharge</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Customer Subscription Paused</Heading>
          <Text style={text}>Hi {tenantName},</Text>
          <Text style={text}>
            This is to notify you that one of your customers has paused their subscription.
          </Text>
          <Section style={section}>
            <Text style={text}>
              <strong>Subscription Details:</strong>
            </Text>
            <Text style={text}>
              <strong>Customer Name:</strong> {customerName}
            </Text>
            <Text style={text}>
              <strong>Customer Email:</strong> {customerEmail}
            </Text>
            <Text style={text}>
              <strong>Plan Name:</strong> {planName}
            </Text>
            <Text style={text}>
              <strong>New Status:</strong> Paused (automatic renewals are on hold)
            </Text>
          </Section>
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
  color: "#f59e0b", // amber-500
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
  backgroundColor: "#fef3c7", // amber-50
  border: "1px solid #fde68a",
  borderRadius: "5px",
  margin: "24px 0",
};
const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
};

export default TenantSubscriptionPausedEmail;
