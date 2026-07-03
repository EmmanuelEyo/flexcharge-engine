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

export interface WithdrawalFailedEmailProps {
  tenantName: string;
  reason: string;
}

export function WithdrawalFailedEmail({
  tenantName,
  reason,
}: WithdrawalFailedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your withdrawal request failed.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Withdrawal Failed</Heading>
          <Text style={text}>Hi {tenantName},</Text>
          <Text style={text}>
            Unfortunately, we were unable to process your recent withdrawal request.
          </Text>
          <Section style={section}>
            <Text style={text}>
              <strong>Reason:</strong> {reason}
            </Text>
          </Section>
          <Text style={text}>
            Please review your settlement account details or contact support for assistance.
          </Text>
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
  color: "#d9534f",
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
  backgroundColor: "#fdf2f2",
  borderRadius: "5px",
  margin: "24px 0",
};
const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
};
