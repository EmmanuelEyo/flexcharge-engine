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

export interface PlanChangedEmailProps {
  customerName: string;
  tenantName: string;
  oldPlanName: string;
  newPlanName: string;
  newAmount: string;
}

export function PlanChangedEmail({
  customerName,
  tenantName,
  oldPlanName,
  newPlanName,
  newAmount,
}: PlanChangedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your subscription plan with {tenantName} has changed</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Subscription Plan Updated</Heading>
          <Text style={text}>Hi {customerName},</Text>
          <Text style={text}>
            Your subscription with <strong>{tenantName}</strong> has been successfully updated.
          </Text>
          <Section style={section}>
            <Text style={text}>
              <strong>Previous Plan:</strong> {oldPlanName}
            </Text>
            <Text style={text}>
              <strong>New Plan:</strong> {newPlanName}
            </Text>
            <Text style={text}>
              <strong>New Rate:</strong> {newAmount}
            </Text>
          </Section>
          <Text style={text}>
            If you did not request this change, please contact customer support immediately.
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

export default PlanChangedEmail;
