import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Preview,
  Button,
} from "react-email";
import * as React from "react";

interface ManualInvoiceReminderEmailProps {
  customerName: string;
  planName: string;
  amount: string;
  tenantName: string;
  checkoutLink: string;
}

/**
 * Manual Invoice Reminder Email — sent to customers during dunning for manual renewals.
 */
export function ManualInvoiceReminderEmail({
  customerName,
  planName,
  amount,
  tenantName,
  checkoutLink,
}: ManualInvoiceReminderEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        Action Required: Pending invoice from {tenantName}
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={brandStyle}>⚡ FlexCharge</Text>
          </Section>

          <Section style={contentStyle}>
            <Heading as="h1" style={headingStyle}>
              Invoice Reminder
            </Heading>
            <Text style={textStyle}>
              Hi {customerName}, this is a reminder that your subscription to <strong>{planName}</strong> with <strong>{tenantName}</strong> is pending payment.
            </Text>

            <Section style={detailBoxStyle}>
              <Text style={detailLabelStyle}>Amount Due</Text>
              <Text style={detailValueStyle}>{amount}</Text>
            </Section>

            <Text style={textStyle}>
              To avoid any interruption to your service, please click the button below to complete your payment using Card, Bank Transfer, or USSD.
            </Text>

            <Button href={checkoutLink} style={buttonStyle}>
              Pay Invoice Now
            </Button>
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

export default ManualInvoiceReminderEmail;

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
  backgroundColor: "#E53E3E", // Red header for reminder
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

const detailBoxStyle: React.CSSProperties = {
  backgroundColor: "#f8f7ff",
  borderRadius: "8px",
  padding: "20px 24px",
  margin: "16px 0 24px 0",
};

const detailLabelStyle: React.CSSProperties = {
  color: "#6b6b8a",
  fontSize: "12px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 4px 0",
};

const detailValueStyle: React.CSSProperties = {
  color: "#1a1a2e",
  fontSize: "16px",
  fontWeight: 600,
  margin: "0",
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#E53E3E", // Match header color
  color: "#fff",
  fontSize: "16px",
  fontWeight: 600,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  width: "100%",
  padding: "16px 0",
  borderRadius: "8px",
  marginTop: "24px",
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
