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

interface TenantNewSubscriberEmailProps {
  tenantName: string;
  customerName: string;
  customerEmail: string;
  planName: string;
  amount: string;
  interval: string;
}

/**
 * Tenant New Subscriber Email — alerts the developer when a
 * new customer subscribes to one of their plans.
 */
export function TenantNewSubscriberEmail({
  tenantName,
  customerName,
  customerEmail,
  planName,
  amount,
  interval,
}: TenantNewSubscriberEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        🎉 New subscriber: {customerName} just signed up for {planName}
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={brandStyle}>⚡ FlexCharge — Developer Alert</Text>
          </Section>

          <Section style={contentStyle}>
            <Heading as="h1" style={headingStyle}>
              🎉 New Subscriber!
            </Heading>
            <Text style={textStyle}>
              Hi {tenantName}, a new customer just subscribed to your platform:
            </Text>

            <Section style={detailBoxStyle}>
              <Text style={detailLabelStyle}>Customer</Text>
              <Text style={detailValueStyle}>{customerName}</Text>
              <Hr style={hrStyle} />
              <Text style={detailLabelStyle}>Email</Text>
              <Text style={detailValueStyle}>{customerEmail}</Text>
              <Hr style={hrStyle} />
              <Text style={detailLabelStyle}>Plan</Text>
              <Text style={detailValueStyle}>{planName}</Text>
              <Hr style={hrStyle} />
              <Text style={detailLabelStyle}>Revenue</Text>
              <Text style={detailValueStyle}>
                {amount} / {interval}
              </Text>
            </Section>

            <Text style={textStyle}>
              Log in to your FlexCharge dashboard to view full details.
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

export default TenantNewSubscriberEmail;

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
  backgroundColor: "#059669",
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
  backgroundColor: "#f0fdf4",
  borderRadius: "8px",
  padding: "20px 24px",
  margin: "16px 0 24px 0",
  border: "1px solid #bbf7d0",
};

const detailLabelStyle: React.CSSProperties = {
  color: "#166534",
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
  borderColor: "#bbf7d0",
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
