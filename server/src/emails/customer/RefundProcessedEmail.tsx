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

export interface RefundProcessedEmailProps {
  customerName: string;
  tenantName: string;
  invoiceId: string;
}

export function RefundProcessedEmail({
  customerName,
  tenantName,
  invoiceId,
}: RefundProcessedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your refund has been processed by {tenantName}.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Refund Processed</Heading>
          <Text style={text}>Hi {customerName},</Text>
          <Text style={text}>
            Your refund for <strong>Invoice {invoiceId}</strong> has been successfully processed by {tenantName}.
          </Text>
          <Section style={section}>
            <Text style={text}>
              The funds have been sent to your bank account. Please allow a few business days for the transaction to reflect, depending on your bank's processing times.
            </Text>
          </Section>
          <Text style={text}>
            If you have any questions, please reply directly to this email.
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
  color: "#333",
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
  backgroundColor: "#f4f4f4",
  borderRadius: "5px",
  margin: "24px 0",
};
const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
};
