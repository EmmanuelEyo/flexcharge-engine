import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
  Preview,
} from "react-email";
import * as React from "react";

interface DunningEmailProps {
  customerName: string;
  planName: string;
  amount: string;
  tenantName: string;
  failureReason: string;
  attemptNumber: number;
}

/**
 * Dunning Email — sent to the customer when a recurring charge fails.
 */
export function DunningEmail({
  customerName,
  planName,
  amount,
  tenantName,
  failureReason,
  attemptNumber,
}: DunningEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        Action required — your payment to {tenantName} failed
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={brandStyle}>⚡ FlexCharge</Text>
          </Section>

          <Section style={contentStyle}>
            <Heading as="h1" style={headingStyle}>
              Payment Failed
            </Heading>
            <Text style={textStyle}>
              Hi {customerName}, we were unable to process your payment for your{" "}
              <strong>{planName}</strong> subscription with{" "}
              <strong>{tenantName}</strong>.
            </Text>

            <Section style={warningBoxStyle}>
              <Text style={warningLabelStyle}>Reason</Text>
              <Text style={warningValueStyle}>{failureReason}</Text>
              <Hr style={hrStyle} />
              <Text style={warningLabelStyle}>Amount</Text>
              <Text style={warningValueStyle}>{amount}</Text>
              <Hr style={hrStyle} />
              <Text style={warningLabelStyle}>Retry Attempt</Text>
              <Text style={warningValueStyle}>{attemptNumber} of 5</Text>
            </Section>

            <Text style={textStyle}>
              We will automatically retry this charge. To avoid service
              disruption, please ensure your card has sufficient funds or update
              your payment method.
            </Text>

            <Text style={cautionTextStyle}>
              If we are unable to collect payment after 5 attempts, your
              subscription will be suspended.
            </Text>
          </Section>

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              Powered by FlexCharge — Flexible billing for African businesses.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default DunningEmail;

// ── Styles ──
const bodyStyle: React.CSSProperties = {
  backgroundColor: "#f4f4f7",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  margin: 0,
  padding: 0,
};

const containerStyle: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  backgroundColor: "#4F46E5",
  padding: "24px 32px",
};

const brandStyle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: 700,
  margin: 0,
};

const contentStyle: React.CSSProperties = {
  padding: "32px",
};

const headingStyle: React.CSSProperties = {
  color: "#1a1a2e",
  fontSize: "24px",
  fontWeight: 700,
  margin: "0 0 16px 0",
};

const textStyle: React.CSSProperties = {
  color: "#4a4a6a",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px 0",
};

const warningBoxStyle: React.CSSProperties = {
  backgroundColor: "#fff5f5",
  borderRadius: "8px",
  padding: "20px 24px",
  margin: "16px 0 24px 0",
  border: "1px solid #fed7d7",
};

const warningLabelStyle: React.CSSProperties = {
  color: "#9b2c2c",
  fontSize: "12px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 4px 0",
};

const warningValueStyle: React.CSSProperties = {
  color: "#1a1a2e",
  fontSize: "16px",
  fontWeight: 600,
  margin: "0 0 8px 0",
};

const hrStyle: React.CSSProperties = {
  borderColor: "#fed7d7",
  margin: "12px 0",
};

const cautionTextStyle: React.CSSProperties = {
  color: "#9b2c2c",
  fontSize: "14px",
  fontWeight: 500,
  backgroundColor: "#fff5f5",
  padding: "12px 16px",
  borderRadius: "6px",
  margin: "0 0 16px 0",
};

const footerStyle: React.CSSProperties = {
  padding: "24px 32px",
  borderTop: "1px solid #eee",
};

const footerTextStyle: React.CSSProperties = {
  color: "#999",
  fontSize: "12px",
  textAlign: "center" as const,
  margin: 0,
};
