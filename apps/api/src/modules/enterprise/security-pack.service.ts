export interface SecurityQuestionAnswer {
  category: string;
  question: string;
  answer: string;
  standard: string;
}

export class SecurityPackService {
  /**
   * Returns enterprise security questionnaire answers pack.
   */
  getSecurityPack(): {
    overview: string;
    certifications: string[];
    qaList: SecurityQuestionAnswer[];
  } {
    return {
      overview: 'PropBot Pro Enterprise Security Architecture & Compliance Questionnaire Answers Pack',
      certifications: ['SOC 2 Type II Compliant', 'ISO/IEC 27001:2022 Aligned', 'India DPDP Act 2023 Compliant', 'GDPR Ready'],
      qaList: [
        {
          category: 'Tenant Isolation & Data Architecture',
          question: 'How is customer tenant data separated?',
          answer: 'PropBot Pro enforces strict multi-tenant Row-Level Security (RLS) in PostgreSQL 16. Every table is guarded with app.company_id session variables. Cross-tenant queries are blocked at the database engine level.',
          standard: 'SOC 2 CC6.1 / ISO 27001 A.8.24',
        },
        {
          category: 'Encryption',
          question: 'What encryption standards are applied in transit and at rest?',
          answer: 'All external and internal traffic requires TLS 1.3 encryption. All persistent storage, database volumes, and backups are encrypted at rest using AES-256 with AWS/GCP KMS key rotation.',
          standard: 'SOC 2 CC6.6 / ISO 27001 A.8.24',
        },
        {
          category: 'Access Control & Authentication',
          question: 'Does the platform support enterprise Single Sign-On and MFA?',
          answer: 'Yes. PropBot Pro supports SAML 2.0 and OIDC Identity Providers (Okta, Azure AD / Entra ID, Google Workspace, PingIdentity) with domain-level SSO enforcement and mandatory 2FA policies.',
          standard: 'SOC 2 CC6.2 / ISO 27001 A.5.15',
        },
        {
          category: 'AI Safety & Action Guardrails',
          question: 'How are AI actions safeguarded against hallucinations or unauthorized modifications?',
          answer: 'AI actions are compartmentalized into strict tiers (T0 read-only, T1 low risk, T2 financial/scheduling requiring human approval or auto-approval rules, T3 irreversible strictly prohibited for AI). An emergency kill switch immediately stops all autonomous operations across channels.',
          standard: 'Responsible AI Governance',
        },
        {
          category: 'Audit Logging & Monitoring',
          question: 'Are user and API actions audited?',
          answer: 'Every CRUD operation, MCP tool execution, and authentication event is immutably logged with actor ID, IP address, timestamp, resource ID, and execution duration. Logs can be exported via CSV or SIEM stream.',
          standard: 'SOC 2 CC7.2 / ISO 27001 A.8.15',
        },
        {
          category: 'Data Residency & Privacy',
          question: 'Where is customer data hosted and how is personal data handled?',
          answer: 'Data residency is localized (AWS ap-south-1 Mumbai for Indian enterprise accounts). The platform complies with India DPDP Act 2023 and GDPR, supporting right-to-be-forgotten and DND consent verification.',
          standard: 'India DPDP Act 2023 / GDPR Art. 17',
        },
        {
          category: 'Availability & SLA',
          question: 'What is the service availability SLA and disaster recovery plan?',
          answer: 'PropBot Pro guarantees a 99.90% monthly uptime SLA. Automated database backups occur continuously with point-in-time recovery (PITR) RPO < 5 minutes and RTO < 30 minutes.',
          standard: 'SOC 2 CC7.3 / ISO 27001 A.8.14',
        },
      ],
    };
  }
}

export const securityPackService = new SecurityPackService();
