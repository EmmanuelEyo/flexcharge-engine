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

interface TenantPaymentFailedEmailProps {
  tenantName: string;
  customerName: string;
  customerEmail: string;
  planName: string;
  amount: string;
  failureReason: string;
  attemptNumber: number;
}

/**
 * Tenant Payment Failed Email — alerts the developer when a customer's
 * recurring charge fails and enters dunning.
 */
export function TenantPaymentFailedEmail({
  tenantName,
  customerName,
  customerEmail,
  planName,
  amount,
  failureReason,
  attemptNumber,
}: TenantPaymentFailedEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        ⚠️ Payment failed for {customerName} — {planName}
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={brandStyle}>⚡ FlexCharge — Developer Alert</Text>
          </Section>

          <Section style={contentStyle}>
            <Heading as="h1" style={headingStyle}>
              ⚠️ Payment Failed
            </Heading>
            <Text style={textStyle}>
              Hi {tenantName}, a recurring charge for one of your customers has
              failed:
            </Text>

            <Section style={warningBoxStyle}>
              <Text style={warningLabelStyle}>Customer</Text>
              <Text style={warningValueStyle}>
                {customerName} ({customerEmail})
              </Text>
              <Hr style={hrStyle} />
              <Text style={warningLabelStyle}>Plan</Text>
              <Text style={warningValueStyle}>{planName}</Text>
              <Hr style={hrStyle} />
              <Text style={warningLabelStyle}>Amount</Text>
              <Text style={warningValueStyle}>{amount}</Text>
              <Hr style={hrStyle} />
              <Text style={warningLabelStyle}>Reason</Text>
              <Text style={warningValueStyle}>{failureReason}</Text>
              <Hr style={hrStyle} />
              <Text style={warningLabelStyle}>Retry Attempt</Text>
              <Text style={warningValueStyle}>{attemptNumber} of 5</Text>
            </Section>

            <Text style={textStyle}>
              FlexCharge will automatically retry the charge according to our
              smart dunning schedule. You may also reach out to the customer
              proactively to help resolve the issue.
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

export default TenantPaymentFailedEmail;

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
  backgroundColor: "#d97706",
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
  backgroundColor: "#fffbeb",
  borderRadius: "8px",
  padding: "20px 24px",
  margin: "16px 0 24px 0",
  border: "1px solid #fde68a",
};

const warningLabelStyle: React.CSSProperties = {
  color: "#92400e",
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
  borderColor: "#fde68a",
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
