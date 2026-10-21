import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader.js';
import { LeadsTable } from '../components/crm/LeadsTable.js';

/** Buyers who have booked or converted, shown in the same grid as Leads. */
export const ClientsPage: React.FC = () => (
  <div>
    <PageHeader
      title="Clients"
      description={
        <>
          Buyers who have booked or closed with you. Looking for merge tools and raw contact records? Open{' '}
          <Link to="/contacts" className="font-semibold text-accent underline-offset-2 hover:underline">Contacts</Link>.
        </>
      }
    />
    <LeadsTable statuses={['booked', 'converted']} noun={{ singular: 'client', plural: 'clients' }} allowAdd={false} />
  </div>
);

export default ClientsPage;
