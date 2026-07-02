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

interface TenantCancelEmailProps {
  tenantName: string;
  customerName: string;
  customerEmail: string;
  planName: string;
  reason?: string;
}

/**
 * Tenant Cancel Email — alerts the developer when a customer
 * cancels their subscription.
 */
export function TenantCancelEmail({
  tenantName,
  customerName,
  customerEmail,
  planName,
  reason,
}: TenantCancelEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        ❌ {customerName} canceled their {planName} subscription
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={brandStyle}>⚡ FlexCharge — Developer Alert</Text>
          </Section>

          <Section style={contentStyle}>
            <Heading as="h1" style={headingStyle}>
              ❌ Subscription Canceled
            </Heading>
            <Text style={textStyle}>
              Hi {tenantName}, a customer has canceled their subscription:
            </Text>

            <Section style={detailBoxStyle}>
              <Text style={detailLabelStyle}>Customer</Text>
              <Text style={detailValueStyle}>
                {customerName} ({customerEmail})
              </Text>
              <Hr style={hrStyle} />
              <Text style={detailLabelStyle}>Plan</Text>
              <Text style={detailValueStyle}>{planName}</Text>
              {reason && (
                <>
                  <Hr style={hrStyle} />
                  <Text style={detailLabelStyle}>Reason</Text>
                  <Text style={detailValueStyle}>{reason}</Text>
                </>
              )}
            </Section>

            <Text style={textStyle}>
              This customer will no longer be charged. You can view their full
              history in your FlexCharge dashboard.
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

export default TenantCancelEmail;

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
  backgroundColor: "#dc2626",
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
  backgroundColor: "#fef2f2",
  borderRadius: "8px",
  padding: "20px 24px",
  margin: "16px 0 24px 0",
  border: "1px solid #fecaca",
};

const detailLabelStyle: React.CSSProperties = {
  color: "#991b1b",
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
  borderColor: "#fecaca",
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
