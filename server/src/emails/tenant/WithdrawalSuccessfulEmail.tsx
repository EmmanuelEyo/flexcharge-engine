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

export interface WithdrawalSuccessfulEmailProps {
  tenantName: string;
  amount: string; // Formatted currency
}

export function WithdrawalSuccessfulEmail({
  tenantName,
  amount,
}: WithdrawalSuccessfulEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your withdrawal of {amount} was successful.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Withdrawal Successful</Heading>
          <Text style={text}>Hi {tenantName},</Text>
          <Text style={text}>
            Your withdrawal request for <strong>{amount}</strong> has been successfully processed and sent to your registered bank account.
          </Text>
          <Section style={section}>
            <Text style={text}>
              Please allow up to 24 hours for the funds to reflect in your account, depending on your bank's processing times.
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

// Inline styles for basic React Email
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
