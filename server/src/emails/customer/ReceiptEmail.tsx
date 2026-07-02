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

interface ReceiptEmailProps {
  customerName: string;
  planName: string;
  amount: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  tenantName: string;
  invoiceId: string;
}

/**
 * Receipt Email — sent to the customer after a successful recurring renewal.
 */
export function ReceiptEmail({
  customerName,
  planName,
  amount,
  currency,
  periodStart,
  periodEnd,
  tenantName,
  invoiceId,
}: ReceiptEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        Payment receipt from {tenantName} — {amount}
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={brandStyle}>⚡ FlexCharge</Text>
          </Section>

          <Section style={contentStyle}>
            <Heading as="h1" style={headingStyle}>
              Payment Received
            </Heading>
            <Text style={textStyle}>
              Hi {customerName}, your payment to <strong>{tenantName}</strong>{" "}
              has been processed successfully.
            </Text>

            <Section style={detailBoxStyle}>
              <Text style={detailLabelStyle}>Plan</Text>
              <Text style={detailValueStyle}>{planName}</Text>
              <Hr style={hrStyle} />
              <Text style={detailLabelStyle}>Amount Charged</Text>
              <Text style={detailValueStyle}>
                {currency} {amount}
              </Text>
              <Hr style={hrStyle} />
              <Text style={detailLabelStyle}>Billing Period</Text>
              <Text style={detailValueStyle}>
                {periodStart} — {periodEnd}
              </Text>
              <Hr style={hrStyle} />
              <Text style={detailLabelStyle}>Invoice ID</Text>
              <Text style={detailValueStyle}>{invoiceId}</Text>
            </Section>

            <Text style={textStyle}>
              No action is needed. Your next charge will be processed
              automatically on {periodEnd}.
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

export default ReceiptEmail;

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
  margin: "0 0 8px 0",
};

const hrStyle: React.CSSProperties = {
  borderColor: "#e2e0f0",
  margin: "12px 0",
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
