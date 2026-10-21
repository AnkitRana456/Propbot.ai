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
const AgentsPage = React.lazy(() => import('./pages/AgentsPage.js').then((m) => ({ default: m.AgentsPage })));
const AgentStudioPage = React.lazy(() => import('./pages/AgentStudioPage.js').then((m) => ({ default: m.AgentStudioPage })));
const ToolsPage = React.lazy(() => import('./pages/ToolsPage.js').then((m) => ({ default: m.ToolsPage })));
const FlowsPage = React.lazy(() => import('./pages/FlowsPage.js').then((m) => ({ default: m.FlowsPage })));
const FlowCanvasPage = React.lazy(() => import('./pages/FlowCanvasPage.js').then((m) => ({ default: m.FlowCanvasPage })));
const ExecutionsPage = React.lazy(() => import('./pages/ExecutionsPage.js').then((m) => ({ default: m.ExecutionsPage })));
const InboxPage = React.lazy(() => import('./pages/InboxPage.js').then((m) => ({ default: m.InboxPage })));
const LeadSourcesPage = React.lazy(() => import('./pages/LeadSourcesPage.js').then((m) => ({ default: m.LeadSourcesPage })));
const ChannelsPage = React.lazy(() => import('./pages/ChannelsPage.js').then((m) => ({ default: m.ChannelsPage })));
const VoicePage = React.lazy(() => import('./pages/VoicePage.js').then((m) => ({ default: m.VoicePage })));
const DataHubPage = React.lazy(() => import('./pages/DataHubPage.js').then((m) => ({ default: m.DataHubPage })));
const BoardsPage = React.lazy(() => import('./pages/BoardsPage.js').then((m) => ({ default: m.BoardsPage })));
const DashboardsPage = React.lazy(() => import('./pages/DashboardsPage.js').then((m) => ({ default: m.DashboardsPage })));
const Contact360Page = React.lazy(() => import('./pages/Contact360Page.js').then((m) => ({ default: m.Contact360Page })));
const ControlsPage = React.lazy(() => import('./pages/ControlsPage.js').then((m) => ({ default: m.ControlsPage })));
const ChangelogPage = React.lazy(() => import('./pages/ChangelogPage.js').then((m) => ({ default: m.ChangelogPage })));
const BillingPage = React.lazy(() => import('./pages/BillingPage.js').then((m) => ({ default: m.BillingPage })));
const StyleguidePage = React.lazy(() => import('./pages/StyleguidePage.js').then((m) => ({ default: m.StyleguidePage })));
const FormsPage = React.lazy(() => import('./pages/FormsPage.js').then((m) => ({ default: m.FormsPage })));
const LeadsPage = React.lazy(() => import('./pages/LeadsPage.js').then((m) => ({ default: m.LeadsPage })));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage.js').then((m) => ({ default: m.NotFoundPage })));
const ClientsPage = React.lazy(() => import('./pages/ClientsPage.js').then((m) => ({ default: m.ClientsPage })));
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
      <Route path="/styleguide" element={<StyleguidePage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/changelog" element={<ChangelogPage />} />
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
        <Route path="agents" element={<AgentsPage />} />
        <Route path="agents/:id" element={<AgentStudioPage />} />
        <Route path="flows" element={<FlowsPage />} />
        <Route path="flows/:id" element={<FlowCanvasPage />} />
        <Route path="executions" element={<ExecutionsPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="lead-sources" element={<LeadSourcesPage />} />
        <Route path="channels" element={<ChannelsPage />} />
        <Route path="voice" element={<VoicePage />} />
        <Route path="data" element={<DataHubPage />} />
        <Route path="boards" element={<BoardsPage />} />
        <Route path="dashboards" element={<DashboardsPage />} />
        <Route path="contacts/:id" element={<Contact360Page />} />
        <Route path="controls" element={<ControlsPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="tools/actions" element={<ToolsPage />} />
        <Route path="forms" element={<FormsPage />} />
        <Route path="whatsapp" element={<WhatsAppPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="clients" element={<ClientsPage />} />
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
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </React.Suspense>
  );
};

export default App;
