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

export interface TenantSubscriptionResumedEmailProps {
  tenantName: string;
  customerName: string;
  customerEmail: string;
  planName: string;
}

export function TenantSubscriptionResumedEmail({
  tenantName,
  customerName,
  customerEmail,
  planName,
}: TenantSubscriptionResumedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>A customer resumed their subscription — FlexCharge</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Customer Subscription Resumed</Heading>
          <Text style={text}>Hi {tenantName},</Text>
          <Text style={text}>
            This is to notify you that one of your customers has resumed their subscription.
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
              <strong>New Status:</strong> Active (automated billing has been restored)
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
  color: "#10b981", // emerald-500
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
  backgroundColor: "#ecfdf5", // emerald-50
  border: "1px solid #a7f3d0",
  borderRadius: "5px",
  margin: "24px 0",
};
const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
};

export default TenantSubscriptionResumedEmail;
