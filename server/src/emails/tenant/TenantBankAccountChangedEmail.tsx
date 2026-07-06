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

export interface TenantBankAccountChangedEmailProps {
  tenantName: string;
  bankName: string;
  accountNumber: string;
}

export function TenantBankAccountChangedEmail({
  tenantName,
  bankName,
  accountNumber,
}: TenantBankAccountChangedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Security Alert: Settlement bank account changed</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Settlement Bank Account Updated</Heading>
          <Text style={text}>Hi {tenantName},</Text>
          <Text style={text}>
            This is a security notification that the settlement bank account for your FlexCharge merchant account has been changed.
          </Text>
          <Section style={section}>
            <Text style={text}>
              <strong>New Bank Details:</strong>
            </Text>
            <Text style={text}>
              <strong>Bank:</strong> {bankName}
            </Text>
            <Text style={text}>
              <strong>Account Number:</strong> •••• {accountNumber.slice(-4)}
            </Text>
          </Section>
          <Text style={text}>
            Future payouts and manual withdrawals will be settled to this newly configured account.
          </Text>
          <Text style={{ ...text, color: "#dc2626", fontWeight: "bold" }}>
            If you did not request this update, please contact support and disable your API credentials immediately.
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
  backgroundColor: "#fef2f2", // red-50
  border: "1px solid #fca5a5",
  borderRadius: "5px",
  margin: "24px 0",
};
const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
};

export default TenantBankAccountChangedEmail;
