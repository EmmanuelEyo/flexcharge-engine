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

interface CancelEmailProps {
  customerName: string;
  planName: string;
  tenantName: string;
  reason?: string;
}

/**
 * Cancel Email — sent to the customer when their subscription is canceled.
 */
export function CancelEmail({
  customerName,
  planName,
  tenantName,
  reason,
}: CancelEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        Your {planName} subscription with {tenantName} has been canceled
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={brandStyle}>⚡ FlexCharge</Text>
          </Section>

          <Section style={contentStyle}>
            <Heading as="h1" style={headingStyle}>
              Subscription Canceled
            </Heading>
            <Text style={textStyle}>
              Hi {customerName}, your <strong>{planName}</strong> subscription
              with <strong>{tenantName}</strong> has been canceled.
            </Text>

            {reason && (
              <Section style={detailBoxStyle}>
                <Text style={detailLabelStyle}>Reason</Text>
                <Text style={detailValueStyle}>{reason}</Text>
              </Section>
            )}

            <Text style={textStyle}>
              You will no longer be charged for this plan. If this was a
              mistake, please contact {tenantName} to resubscribe.
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

export default CancelEmail;

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
