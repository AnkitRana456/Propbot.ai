import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { HelpSupportPage } from './pages/HelpSupportPage.js';
import { AuthPage } from './pages/AuthPage.js';
import { ChatbotsListPage } from './pages/ChatbotsListPage.js';
import { ChatbotWizardPage } from './pages/ChatbotWizardPage.js';
import { ChatbotSettingsPage } from './pages/ChatbotSettingsPage.js';
import { ChatbotTrainingPage } from './pages/ChatbotTrainingPage.js';
import { LeadsPage } from './pages/LeadsPage.js';
import { ContactsPage } from './pages/ContactsPage.js';
import { PropertiesPage } from './pages/PropertiesPage.js';
import { ProjectDetailPage } from './pages/ProjectDetailPage.js';
import { ShortlistRoomPage } from './pages/ShortlistRoomPage.js';
import { AppointmentsPage } from './pages/AppointmentsPage.js';
import { AppointmentSurveyPage } from './pages/AppointmentSurveyPage.js';
import { WhatsAppPage } from './pages/WhatsAppPage.js';
import { WebhookLogsPage } from './pages/WebhookLogsPage.js';
import { AnalyticsPage } from './pages/AnalyticsPage.js';
import { UsersPage } from './pages/UsersPage.js';
import { SubscriptionPage } from './pages/SubscriptionPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { ApprovalsPage } from './pages/ApprovalsPage.js';
import { WorkflowsPage } from './pages/WorkflowsPage.js';
import { CampaignsPage } from './pages/CampaignsPage.js';
import { StatusPage } from './pages/StatusPage.js';
import { PlatformPage } from './pages/PlatformPage.js';
import { DesignSystemPage } from './pages/DesignSystemPage.js';
import AnalyticsDashboard from './components/AnalyticsDashboard.js';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/platform" element={<PlatformPage />} />
      <Route path="/analytics-dashboard" element={<AnalyticsDashboard />} />
      <Route path="/cue-analytics" element={<AnalyticsDashboard />} />
      <Route path="/design" element={<DesignSystemPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/room/:token" element={<ShortlistRoomPage />} />
      <Route path="/survey/:token" element={<AppointmentSurveyPage />} />
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="design" element={<DesignSystemPage />} />
        <Route path="chatbots" element={<ChatbotsListPage />} />
        <Route path="chatbots/new" element={<ChatbotWizardPage />} />
        <Route path="chatbots/:id/wizard" element={<ChatbotWizardPage />} />
        <Route path="chatbots/:id/edit" element={<ChatbotSettingsPage />} />
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
  );
};

export default App;
