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

export interface WalletToppedUpEmailProps {
  customerName: string;
  tenantName: string;
  topupAmount: string;
  balanceAfter: string;
}

export function WalletToppedUpEmail({
  customerName,
  tenantName,
  topupAmount,
  balanceAfter,
}: WalletToppedUpEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Wallet topped up successfully — {tenantName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Wallet Top-Up Successful</Heading>
          <Text style={text}>Hi {customerName},</Text>
          <Text style={text}>
            Your credit wallet for <strong>{tenantName}</strong> has been topped up successfully.
          </Text>
          <Section style={section}>
            <Text style={text}>
              <strong>Top-Up Amount:</strong> {topupAmount}
            </Text>
            <Text style={text}>
              <strong>New Wallet Balance:</strong> {balanceAfter}
            </Text>
          </Section>
          <Text style={text}>
            These credits will be automatically consumed for your recurring subscription billing.
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

export default WalletToppedUpEmail;
