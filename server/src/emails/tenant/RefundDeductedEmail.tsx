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

export interface RefundDeductedEmailProps {
  tenantName: string;
  invoiceId: string;
}

export function RefundDeductedEmail({
  tenantName,
  invoiceId,
}: RefundDeductedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>A refund has been deducted from your ledger.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Refund Processed</Heading>
          <Text style={text}>Hi {tenantName},</Text>
          <Text style={text}>
            A refund has been successfully processed for <strong>Invoice {invoiceId}</strong>.
          </Text>
          <Section style={section}>
            <Text style={text}>
              The refunded amount has been deducted from your available ledger balance. 
              The customer will receive the funds in their bank account shortly.
            </Text>
          </Section>
          <Text style={footer}>
            FlexCharge Inc. &copy; {new Date().getFullYear()}
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
