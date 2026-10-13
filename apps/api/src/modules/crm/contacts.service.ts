import { eq, and, sql, desc, isNull, or, ilike } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { contacts, organizations, leads, leadActivities } from '../../db/schema/index.js';
import type {
  ContactItem,
  ContactsListResponse,
  CreateContactInput,
  OrganizationItem,
  OrganizationsListResponse,
  CreateOrganizationInput,
} from '@propbot/shared';

export class ContactsService {
  /**
   * Lists contacts with linked leads count, organization names, search, and pagination.
   */
  async listContacts(
    companyId: string,
    options: {
      search?: string;
      organizationId?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<ContactsListResponse> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions = [eq(contacts.companyId, companyId), isNull(contacts.deletedAt)];

    if (options.organizationId) {
      conditions.push(eq(contacts.organizationId, options.organizationId));
    }

    if (options.search && options.search.trim()) {
      const q = `%${options.search.trim()}%`;
      conditions.push(
        or(
          ilike(contacts.firstName, q),
          ilike(contacts.lastName, q),
          ilike(contacts.phone, q),
          ilike(contacts.email, q),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(whereClause);

    const total = countRow?.count ?? 0;

    const rows = await db
      .select({
        contact: contacts,
        organization: organizations,
        leadCount: sql<number>`count(distinct ${leads.id})::int`,
        lastActiveAt: sql<string>`max(${leads.updatedAt})`,
      })
      .from(contacts)
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .leftJoin(leads, and(eq(leads.contactId, contacts.id), isNull(leads.deletedAt)))
      .where(whereClause)
      .groupBy(contacts.id, organizations.id)
      .orderBy(desc(contacts.createdAt))
      .limit(limit)
      .offset(offset);

    const items: ContactItem[] = rows.map(({ contact, organization, leadCount, lastActiveAt }) => {
      const fullName = `${contact.firstName} ${contact.lastName || ''}`.trim();

      return {
        id: contact.id,
        companyId: contact.companyId,
        organizationId: contact.organizationId,
        organizationName: organization?.name || null,
        firstName: contact.firstName,
        lastName: contact.lastName,
        name: fullName,
        email: contact.email,
        phone: contact.phone,
        altPhone: contact.altPhone,
        lifecycleStage: contact.lifecycleStage,
        leadCount: leadCount || 0,
        lastActiveAt: lastActiveAt ? new Date(lastActiveAt).toISOString() : null,
        createdAt: contact.createdAt.toISOString(),
        updatedAt: contact.updatedAt.toISOString(),
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves single contact by ID with all linked leads.
   */
  async getContactById(companyId: string, contactId: string) {
    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, contactId), eq(contacts.companyId, companyId), isNull(contacts.deletedAt)),
    });

    if (!contact) {
      throw new Error('Contact not found');
    }

    const organization = contact.organizationId
      ? await db.query.organizations.findFirst({
          where: eq(organizations.id, contact.organizationId),
        })
      : null;

    const linkedLeads = await db.query.leads.findMany({
      where: and(eq(leads.contactId, contactId), eq(leads.companyId, companyId), isNull(leads.deletedAt)),
      orderBy: desc(leads.createdAt),
    });

    const fullName = `${contact.firstName} ${contact.lastName || ''}`.trim();

    return {
      contact: {
        id: contact.id,
        companyId: contact.companyId,
        organizationId: contact.organizationId,
        organizationName: organization?.name || null,
        firstName: contact.firstName,
        lastName: contact.lastName,
        name: fullName,
        email: contact.email,
        phone: contact.phone,
        altPhone: contact.altPhone,
        lifecycleStage: contact.lifecycleStage,
        leadCount: linkedLeads.length,
        createdAt: contact.createdAt.toISOString(),
        updatedAt: contact.updatedAt.toISOString(),
      },
      leads: linkedLeads,
    };
  }

  /**
   * Creates a new contact.
   */
  async createContact(companyId: string, input: CreateContactInput): Promise<ContactItem> {
    const [newContact] = await db
      .insert(contacts)
      .values({
        companyId,
        firstName: input.firstName.trim(),
        lastName: input.lastName ? input.lastName.trim() : null,
        phone: input.phone.trim(),
        email: input.email ? input.email.trim().toLowerCase() : null,
        altPhone: input.altPhone ? input.altPhone.trim() : null,
        organizationId: input.organizationId ?? null,
      })
      .returning();

    if (!newContact) {
      throw new Error('Failed to create contact');
    }

    const org = newContact.organizationId
      ? await db.query.organizations.findFirst({ where: eq(organizations.id, newContact.organizationId) })
      : null;

    return {
      id: newContact.id,
      companyId: newContact.companyId,
      organizationId: newContact.organizationId,
      organizationName: org?.name || null,
      firstName: newContact.firstName,
      lastName: newContact.lastName,
      name: `${newContact.firstName} ${newContact.lastName || ''}`.trim(),
      email: newContact.email,
      phone: newContact.phone,
      altPhone: newContact.altPhone,
      lifecycleStage: newContact.lifecycleStage,
      leadCount: 0,
      lastActiveAt: null,
      createdAt: newContact.createdAt.toISOString(),
      updatedAt: newContact.updatedAt.toISOString(),
    };
  }

  /**
   * Merges two contacts: re-points all leads and activities from source to target, then soft deletes source.
   */
  async mergeContacts(companyId: string, sourceContactId: string, targetContactId: string) {
    const source = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, sourceContactId), eq(contacts.companyId, companyId)),
    });
    const target = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, targetContactId), eq(contacts.companyId, companyId)),
    });

    if (!source || !target) {
      throw new Error('Source or target contact not found');
    }

    await db.transaction(async tx => {
      // Re-link leads from source to target
      await tx
        .update(leads)
        .set({ contactId: targetContactId, updatedAt: new Date() })
        .where(and(eq(leads.contactId, sourceContactId), eq(leads.companyId, companyId)));

      // Re-link lead activities
      await tx
        .update(leadActivities)
        .set({ contactId: targetContactId, updatedAt: new Date() })
        .where(and(eq(leadActivities.contactId, sourceContactId), eq(leadActivities.companyId, companyId)));

      // Soft-delete source contact
      await tx
        .update(contacts)
        .set({ deletedAt: new Date() })
        .where(and(eq(contacts.id, sourceContactId), eq(contacts.companyId, companyId)));
    });

    return this.getContactById(companyId, targetContactId);
  }

  /**
   * Lists organizations.
   */
  async listOrganizations(companyId: string): Promise<OrganizationsListResponse> {
    const rows = await db
      .select({
        org: organizations,
        contactsCount: sql<number>`count(${contacts.id})::int`,
      })
      .from(organizations)
      .leftJoin(contacts, and(eq(contacts.organizationId, organizations.id), isNull(contacts.deletedAt)))
      .where(and(eq(organizations.companyId, companyId), isNull(organizations.deletedAt)))
      .groupBy(organizations.id)
      .orderBy(desc(organizations.createdAt));

    const items: OrganizationItem[] = rows.map(({ org, contactsCount }) => ({
      id: org.id,
      companyId: org.companyId,
      name: org.name,
      industry: org.industry,
      website: org.website,
      phone: org.phone,
      address: org.address,
      contactsCount: contactsCount || 0,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    }));

    return {
      items,
      total: items.length,
    };
  }

  /**
   * Creates an organization.
   */
  async createOrganization(companyId: string, input: CreateOrganizationInput): Promise<OrganizationItem> {
    const [newOrg] = await db
      .insert(organizations)
      .values({
        companyId,
        name: input.name.trim(),
        industry: input.industry?.trim() || null,
        website: input.website?.trim() || null,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
      })
      .returning();

    if (!newOrg) {
      throw new Error('Failed to create organization');
    }

    return {
      id: newOrg.id,
      companyId: newOrg.companyId,
      name: newOrg.name,
      industry: newOrg.industry,
      website: newOrg.website,
      phone: newOrg.phone,
      address: newOrg.address,
      contactsCount: 0,
      createdAt: newOrg.createdAt.toISOString(),
      updatedAt: newOrg.updatedAt.toISOString(),
    };
  }
}

export const contactsService = new ContactsService();
