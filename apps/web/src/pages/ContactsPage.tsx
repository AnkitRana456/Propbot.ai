import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Building2,
  Phone,
  Mail,
  GitMerge,
  ChevronRight,
  Plus,
  X,
} from 'lucide-react';
import { useContacts, useContact, useCreateContact, useMergeContacts } from '../services/contacts.service.js';
import type { ContactItem, LeadItemResponse } from '@propbot/shared';
import { Skeleton } from '../components/common/Skeleton.js';
import { EmptyState } from '../components/common/EmptyState.js';

export const ContactsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState<string>('');

  const { data: contactsData, isLoading } = useContacts({
    search: searchQuery || undefined,
  });

  const { data: selectedDetail } = useContact(
    selectedContactId || undefined,
  );

  const createContactMutation = useCreateContact();
  const mergeMutation = useMergeContacts();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const contactsList = contactsData?.items || [];

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !phone.trim()) return;
    await createContactMutation.mutateAsync({
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      phone: phone.trim(),
      email: email.trim() || undefined,
    });
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setIsCreateOpen(false);
  };

  const handleMerge = async () => {
    if (!mergeSourceId || !selectedContactId) return;
    await mergeMutation.mutateAsync({
      sourceContactId: mergeSourceId,
      targetContactId: selectedContactId,
    });
    setIsMergeOpen(false);
    setMergeSourceId('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Contacts & Organizations
            </h1>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300">
              Universal Directory
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            One consolidated record per individual linking multiple property inquiries, phone numbers, and organizations.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Contact
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Contacts List Column */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search contacts by name, phone, or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800/50 dark:text-white"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : contactsList.length === 0 ? (
            <EmptyState
              icon={<Users className="h-7 w-7" />}
              title="No Contacts Recorded"
              description="Contacts are automatically organized when leads are captured from the chat widget."
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {contactsList.map((contact: ContactItem) => {
                const isSelected = selectedContactId === contact.id;
                return (
                  <div
                    key={contact.id}
                    onClick={() => setSelectedContactId(contact.id)}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-blue-950/40'
                        : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {contact.firstName[0]?.toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {contact.name}
                        </h4>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {contact.phone}
                          </span>
                          {contact.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {contact.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {contact.leadCount} Inquiries
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Contact Detail Column */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          {selectedContactId && selectedDetail ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedDetail.contact.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedDetail.contact.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                <Link to={`/contacts/${selectedContactId}`} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-orange-50 dark:border-slate-700">360° view</Link>
                <button
                  onClick={() => setIsMergeOpen(true)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <GitMerge className="h-3.5 w-3.5 text-amber-600" />
                  Merge
                </button>
                </div>
              </div>

              {/* Organization link if present */}
              {selectedDetail.contact.organizationName && (
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span>Organization: <strong>{selectedDetail.contact.organizationName}</strong></span>
                </div>
              )}

              {/* Linked Inquiries / Leads */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Linked Lead Inquiries ({selectedDetail.leads.length})
                </h4>
                <div className="space-y-2">
                  {selectedDetail.leads.map((lead: LeadItemResponse) => (
                    <div
                      key={lead.id}
                      className="rounded-xl border border-slate-200/80 p-3 text-xs hover:border-slate-300 dark:border-slate-800 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold capitalize">{lead.status.replace('_', ' ')}</span>
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          {lead.intentScore}% Intent
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Source: {lead.source}</span>
                        <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center text-xs text-slate-400">
              <Users className="h-8 w-8 mb-2 opacity-50" />
              <span>Select a contact to view full profile & linked property inquiries.</span>
            </div>
          )}
        </div>
      </div>

      {/* Add Contact Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white">Add Contact</h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Phone Number *</label>
                <input
                  type="text"
                  required
                  placeholder="+91..."
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createContactMutation.isPending}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Merge Contacts Modal */}
      {isMergeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white">Merge Duplicate Contact</h3>
              <button onClick={() => setIsMergeOpen(false)} className="p-1 text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Select another contact to merge into <strong>{selectedDetail?.contact.name}</strong>. All associated inquiries and timeline activities will be consolidated.
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select Contact to Merge:
                </label>
                <select
                  value={mergeSourceId}
                  onChange={e => setMergeSourceId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">-- Choose contact --</option>
                  {contactsList
                    .filter((c: ContactItem) => c.id !== selectedContactId)
                    .map((c: ContactItem) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName ?? ''} ({c.phone})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMergeOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleMerge}
                  disabled={!mergeSourceId || mergeMutation.isPending}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 cursor-pointer disabled:opacity-50"
                >
                  {mergeMutation.isPending ? 'Merging...' : 'Confirm Merge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
