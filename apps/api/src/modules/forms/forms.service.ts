import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { CreateFormInput, FormFieldInput, FormItem, UpdateFormInput } from '@propbot/shared';
import { db } from '../../db/index.js';
import { agentVersions, agents, domainEvents, formFields, forms, formSubmissions, leads } from '../../db/schema/index.js';
import { ApiError, badRequest, conflict, notFound } from '../../utils/api-error.js';
import { STARTER_BUYER_PROFILE, validateFormValues, type FieldDef } from './form-validation.js';

type FormRow = typeof forms.$inferSelect;
type FieldRow = typeof formFields.$inferSelect;

const toField = (r: FieldRow) => ({
  id: r.id,
  key: r.key,
  label: r.label,
  type: r.type as FormFieldInput['type'],
  required: r.required,
  options: (r.options as string[]) ?? [],
  validation: (r.validation as FormFieldInput['validation']) ?? {},
  defaultValue: r.defaultValue ?? undefined,
  helpText: r.helpText,
  aiHint: r.aiHint,
  collectInChat: r.collectInChat,
  position: r.position,
});

const toForm = (f: FormRow, fields: FieldRow[]): FormItem => ({
  id: f.id,
  key: f.key,
  name: f.name,
  description: f.description,
  purpose: f.purpose as FormItem['purpose'],
  isSystem: f.isSystem,
  fields: fields.sort((a, b) => a.position - b.position).map(toField),
  createdAt: f.createdAt.toISOString(),
  updatedAt: f.updatedAt.toISOString(),
});

/** Select / multiselect fields need choices; keys must be unique inside a form. */
function assertFieldsValid(fields: FormFieldInput[]): void {
  const seen = new Set<string>();
  for (const f of fields) {
    if (seen.has(f.key)) throw badRequest('DUPLICATE_FIELD_KEY', `Field key "${f.key}" is used twice.`);
    seen.add(f.key);
    if ((f.type === 'select' || f.type === 'multiselect') && f.options.length === 0) {
      throw badRequest('MISSING_OPTIONS', `Field "${f.label}" needs at least one choice.`);
    }
    if (f.validation?.pattern) {
      try {
        new RegExp(f.validation.pattern);
      } catch {
        throw badRequest('INVALID_PATTERN', `Field "${f.label}" has an invalid pattern.`);
      }
    }
  }
}

export class FormsService {
  /** First visit: give a company the real-estate "Buyer profile" so the page is never empty. Idempotent. */
  async ensureStarterForms(companyId: string): Promise<void> {
    const [any] = await db.select({ id: forms.id }).from(forms).where(eq(forms.companyId, companyId)).limit(1);
    if (any) return;
    try {
      await this.create(companyId, null, { ...STARTER_BUYER_PROFILE, purpose: 'lead_attributes' } as CreateFormInput, true);
    } catch (err) {
      // A parallel first visit may have created it already
      const e = err as { code?: string; cause?: { code?: string } };
      const duplicate = (err instanceof ApiError && err.statusCode === 409) || e.code === '23505' || e.cause?.code === '23505';
      if (!duplicate) throw err;
    }
  }

  async list(companyId: string): Promise<FormItem[]> {
    await this.ensureStarterForms(companyId);
    const rows = await db
      .select()
      .from(forms)
      .where(and(eq(forms.companyId, companyId), isNull(forms.deletedAt)))
      .orderBy(asc(forms.name));
    if (rows.length === 0) return [];
    const fieldRows = await db.select().from(formFields).where(eq(formFields.companyId, companyId));
    return rows.map(f => toForm(f, fieldRows.filter(x => x.formId === f.id)));
  }

  async get(companyId: string, id: string): Promise<FormItem> {
    const [f] = await db
      .select()
      .from(forms)
      .where(and(eq(forms.id, id), eq(forms.companyId, companyId), isNull(forms.deletedAt)));
    if (!f) throw notFound('Form');
    const fields = await db.select().from(formFields).where(eq(formFields.formId, f.id));
    return toForm(f, fields);
  }

  async create(companyId: string, userId: string | null, input: CreateFormInput, isSystem = false): Promise<FormItem> {
    assertFieldsValid(input.fields);
    const [existing] = await db
      .select({ id: forms.id })
      .from(forms)
      .where(and(eq(forms.companyId, companyId), eq(forms.key, input.key), isNull(forms.deletedAt)));
    if (existing) throw conflict('FORM_KEY_TAKEN', `A form with key "${input.key}" already exists.`);

    const id = await db.transaction(async tx => {
      const [f] = await tx
        .insert(forms)
        .values({
          companyId,
          key: input.key,
          name: input.name,
          description: input.description ?? null,
          purpose: input.purpose,
          isSystem,
          createdBy: userId,
        })
        .returning({ id: forms.id });
      if (input.fields.length > 0) {
        await tx.insert(formFields).values(
          input.fields.map((fld, i) => ({
            formId: f!.id,
            companyId,
            key: fld.key,
            label: fld.label,
            type: fld.type,
            required: fld.required,
            options: fld.options,
            validation: (fld.validation ?? {}) as Record<string, unknown>,
            defaultValue: fld.defaultValue ?? null,
            helpText: fld.helpText ?? null,
            aiHint: fld.aiHint ?? null,
            collectInChat: fld.collectInChat,
            position: i,
          })),
        );
      }
      return f!.id;
    });
    return this.get(companyId, id);
  }

  async update(companyId: string, id: string, input: UpdateFormInput): Promise<FormItem> {
    const current = await this.get(companyId, id);
    if (input.fields) assertFieldsValid(input.fields);

    await db.transaction(async tx => {
      await tx
        .update(forms)
        .set({
          name: input.name ?? current.name,
          description: input.description !== undefined ? input.description : current.description,
          purpose: input.purpose ?? current.purpose,
          updatedAt: new Date(),
        })
        .where(and(eq(forms.id, id), eq(forms.companyId, companyId)));

      if (input.fields) {
        // Replace by key: existing fields keep their id, removed ones are deleted, new ones inserted.
        const keep = new Set(input.fields.map(f => f.key));
        for (const old of current.fields) {
          if (!keep.has(old.key)) await tx.delete(formFields).where(eq(formFields.id, old.id));
        }
        for (const [i, fld] of input.fields.entries()) {
          const values = {
            label: fld.label,
            type: fld.type,
            required: fld.required,
            options: fld.options,
            validation: (fld.validation ?? {}) as Record<string, unknown>,
            defaultValue: fld.defaultValue ?? null,
            helpText: fld.helpText ?? null,
            aiHint: fld.aiHint ?? null,
            collectInChat: fld.collectInChat,
            position: i,
            updatedAt: new Date(),
          };
          const existing = current.fields.find(f => f.key === fld.key);
          if (existing) await tx.update(formFields).set(values).where(eq(formFields.id, existing.id));
          else await tx.insert(formFields).values({ formId: id, companyId, key: fld.key, ...values });
        }
      }
    });
    return this.get(companyId, id);
  }

  async remove(companyId: string, id: string): Promise<void> {
    const form = await this.get(companyId, id);
    if (form.isSystem) throw conflict('SYSTEM_FORM', 'The starter form cannot be deleted. Edit its fields instead.');

    // Refuse while a live agent version still collects data with it
    const [inUse] = await db
      .select({ name: agents.name })
      .from(agentVersions)
      .innerJoin(agents, eq(agents.id, agentVersions.agentId))
      .where(
        and(
          eq(agentVersions.formId, id),
          eq(agents.companyId, companyId),
          isNull(agents.deletedAt),
          sql`${agentVersions.status} IN ('draft','published')`,
        ),
      )
      .limit(1);
    if (inUse) throw conflict('FORM_IN_USE', `Form is used by the agent "${inUse.name}". Detach it first.`);

    await db.update(forms).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(forms.id, id), eq(forms.companyId, companyId)));
  }

  /**
   * Validates `input` against the form and merges the accepted values into the lead's attributes
   * (`leads.custom_fields.attributes`), keeping a history row in form_submissions.
   * Partial by default: chat collects values a few at a time.
   */
  async applyToLead(params: {
    companyId: string;
    formId: string;
    leadId: string;
    values: Record<string, unknown>;
    conversationId?: string | null;
    agentId?: string | null;
    source?: 'chat' | 'manual' | 'import' | 'api';
    partial?: boolean;
  }): Promise<{ saved: Record<string, unknown>; errors: Record<string, string> }> {
    const form = await this.get(params.companyId, params.formId);
    const { values, errors } = validateFormValues(form.fields as FieldDef[], params.values, { partial: params.partial ?? true });
    if (Object.keys(values).length === 0) return { saved: {}, errors };

    const [lead] = await db
      .select({ id: leads.id, customFields: leads.customFields })
      .from(leads)
      .where(and(eq(leads.id, params.leadId), eq(leads.companyId, params.companyId)));
    if (!lead) throw notFound('Lead');

    const custom = (lead.customFields as Record<string, unknown>) ?? {};
    const attributes = { ...((custom.attributes as Record<string, unknown>) ?? {}), ...values };
    await db.transaction(async tx => {
      await tx
        .update(leads)
        .set({ customFields: { ...custom, attributes }, updatedAt: new Date() })
        .where(eq(leads.id, lead.id));
      await tx.insert(formSubmissions).values({
        companyId: params.companyId,
        formId: params.formId,
        leadId: lead.id,
        conversationId: params.conversationId ?? null,
        agentId: params.agentId ?? null,
        values,
        source: params.source ?? 'chat',
      });
      await tx.insert(domainEvents).values({
        companyId: params.companyId,
        type: 'form_submitted',
        payload: { lead_id: lead.id, form_id: params.formId, values },
      });
    });
    return { saved: values, errors };
  }
}

export const formsService = new FormsService();
