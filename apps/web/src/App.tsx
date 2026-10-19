import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell.js';
const DashboardPage = React.lazy(() => import('./pages/DashboardPage.js').then((m) => ({ default: m.DashboardPage })));
const HelpSupportPage = React.lazy(() => import('./pages/HelpSupportPage.js').then((m) => ({ default: m.HelpSupportPage })));
import { AuthPage } from './pages/AuthPage.js';
const ChatbotsListPage = React.lazy(() => import('./pages/ChatbotsListPage.js').then((m) => ({ default: m.ChatbotsListPage })));
const ChatbotWizardPage = React.lazy(() => import('./pages/ChatbotWizardPage.js').then((m) => ({ default: m.ChatbotWizardPage })));
const ChatbotSettingsPage = React.lazy(() => import('./pages/ChatbotSettingsPage.js').then((m) => ({ default: m.ChatbotSettingsPage })));
const ChatbotTrainingPage = React.lazy(() => import('./pages/ChatbotTrainingPage.js').then((m) => ({ default: m.ChatbotTrainingPage })));
const LeadsPage = React.lazy(() => import('./pages/LeadsPage.js').then((m) => ({ default: m.LeadsPage })));
const ContactsPage = React.lazy(() => import('./pages/ContactsPage.js').then((m) => ({ default: m.ContactsPage })));
const PropertiesPage = React.lazy(() => import('./pages/PropertiesPage.js').then((m) => ({ default: m.PropertiesPage })));
const ProjectDetailPage = React.lazy(() => import('./pages/ProjectDetailPage.js').then((m) => ({ default: m.ProjectDetailPage })));
const ShortlistRoomPage = React.lazy(() => import('./pages/ShortlistRoomPage.js').then((m) => ({ default: m.ShortlistRoomPage })));
const AppointmentsPage = React.lazy(() => import('./pages/AppointmentsPage.js').then((m) => ({ default: m.AppointmentsPage })));
const AppointmentSurveyPage = React.lazy(() => import('./pages/AppointmentSurveyPage.js').then((m) => ({ default: m.AppointmentSurveyPage })));
const WhatsAppPage = React.lazy(() => import('./pages/WhatsAppPage.js').then((m) => ({ default: m.WhatsAppPage })));
const WebhookLogsPage = React.lazy(() => import('./pages/WebhookLogsPage.js').then((m) => ({ default: m.WebhookLogsPage })));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage.js').then((m) => ({ default: m.AnalyticsPage })));
const UsersPage = React.lazy(() => import('./pages/UsersPage.js').then((m) => ({ default: m.UsersPage })));
const SubscriptionPage = React.lazy(() => import('./pages/SubscriptionPage.js').then((m) => ({ default: m.SubscriptionPage })));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage.js').then((m) => ({ default: m.SettingsPage })));
const ApprovalsPage = React.lazy(() => import('./pages/ApprovalsPage.js').then((m) => ({ default: m.ApprovalsPage })));
const WorkflowsPage = React.lazy(() => import('./pages/WorkflowsPage.js').then((m) => ({ default: m.WorkflowsPage })));
const CampaignsPage = React.lazy(() => import('./pages/CampaignsPage.js').then((m) => ({ default: m.CampaignsPage })));
const StatusPage = React.lazy(() => import('./pages/StatusPage.js').then((m) => ({ default: m.StatusPage })));
import { PlatformPage } from './pages/PlatformPage.js';
const DesignSystemPage = React.lazy(() => import('./pages/DesignSystemPage.js').then((m) => ({ default: m.DesignSystemPage })));
const AnalyticsDashboard = React.lazy(() => import('./components/AnalyticsDashboard.js'));

const PageFallback: React.FC = () => (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500"
  >
    <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-primary" aria-hidden="true" />
    Loading…
  </div>
);

export const App: React.FC = () => {
  return (
    <React.Suspense fallback={<PageFallback />}>
    <Routes>
      {/* 1. Public Showcase / Platform Landing Page is the Starting Screen */}
      <Route path="/" element={<PlatformPage />} />
      <Route path="/platform" element={<PlatformPage />} />
      <Route path="/analytics-dashboard" element={<AnalyticsDashboard />} />
      <Route path="/cue-analytics" element={<AnalyticsDashboard />} />
      <Route path="/design" element={<DesignSystemPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/room/:token" element={<ShortlistRoomPage />} />
      <Route path="/survey/:token" element={<AppointmentSurveyPage />} />

      {/* 2. Authenticated CRM Application Shell */}
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
      </Route>
      <Route path="/" element={<AppShell />}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="design" element={<DesignSystemPage />} />
        <Route path="chatbots" element={<ChatbotsListPage />} />
        <Route path="chatbots/new" element={<ChatbotWizardPage />} />
        <Route path="chatbots/:id/wizard" element={<ChatbotWizardPage />} />
        <Route path="chatbots/:id/edit" element={<ChatbotSettingsPage />} />
        <Route path="chatbots/:id/settings" element={<ChatbotSettingsPage />} />
        <Route path="chatbots/:id/training" element={<ChatbotTrainingPage />} />
        <Route path="whatsapp" element={<WhatsAppPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="properties" element={<PropertiesPage />} />
        <Route path="properties/:id" element={<ProjectDetailPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="workflows" element={<WorkflowsPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="webhook-logs" element={<WebhookLogsPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="subscription" element={<SubscriptionPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="help" element={<HelpSupportPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
    </React.Suspense>
  );
};

export default App;
