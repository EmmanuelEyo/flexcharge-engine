import React from "react";
import { Html, Head, Preview, Body, Container, Section, Text, Button } from "@react-email/components";

interface PortalLinkEmailProps {
  customerName: string;
  tenantName: string;
  portalUrl: string;
}

export const PortalLinkEmail: React.FC<PortalLinkEmailProps> = ({
  customerName,
  tenantName,
  portalUrl,
}) => {
  return (
    <Html>
      <Head />
      <Preview>Your secure portal access link for {tenantName}</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f9fafb", padding: "20px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "40px", borderRadius: "8px", maxWidth: "600px", margin: "0 auto", border: "1px solid #e5e7eb" }}>
          <Text style={{ fontSize: "24px", fontWeight: "bold", color: "#111827", marginBottom: "20px" }}>
            Hello {customerName},
          </Text>
          <Text style={{ fontSize: "16px", color: "#4b5563", lineHeight: "1.5", marginBottom: "20px" }}>
            You requested a secure link to access your {tenantName} customer portal. Through the portal, you can view your active subscriptions, past invoices, and securely manage your payment methods and wallet settings.
          </Text>
          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Button
              href={portalUrl}
              style={{
                backgroundColor: "#10b981",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: "bold",
                display: "inline-block",
              }}
            >
              Access Customer Portal
            </Button>
          </Section>
          <Text style={{ fontSize: "14px", color: "#6b7280", marginTop: "20px" }}>
            This link will expire soon for your security. If you did not request this link, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};
