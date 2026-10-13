import { db } from '../../db/index.js';
import { units, projects } from '../../db/schema/index.js';
import { eq, and, isNull } from 'drizzle-orm';
import type {
  BulkImportReport,
  BulkImportUnitRow,
  UnitStatus,
} from '@propbot/shared';

export class BulkImportService {
  /**
   * Parses Indian real estate currency strings into raw numeric values (INR).
   * Supports: "1.5 Cr", "75 Lakhs", "₹1,50,00,000", "15000000", "75L", "2.1Cr"
   */
  static parsePrice(raw: string | number | undefined): number {
    if (typeof raw === 'number') return raw;
    if (!raw) return 0;

    const cleaned = String(raw).trim().replace(/₹/g, '').replace(/,/g, '').toLowerCase();

    // Check Crore
    const crMatch = cleaned.match(/^([\d.]+)\s*(?:cr|crore|crores)$/);
    if (crMatch && crMatch[1]) {
      return Math.round(parseFloat(crMatch[1]) * 10000000);
    }

    // Check Lakh
    const lMatch = cleaned.match(/^([\d.]+)\s*(?:l|lac|lakh|lakhs)$/);
    if (lMatch && lMatch[1]) {
      return Math.round(parseFloat(lMatch[1]) * 100000);
    }

    // Direct number
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num);
  }

  /**
   * Parses numeric area string or number.
   */
  static parseArea(raw: string | number | undefined): number {
    if (typeof raw === 'number') return raw;
    if (!raw) return 0;
    const cleaned = String(raw).replace(/sq\.?ft\.?/gi, '').replace(/,/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Parses CSV string into structured row objects.
   */
  static parseCsv(csvText: string): Record<string, string>[] {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2 || !lines[0]) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\s_-]+/g, ''));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Basic split with quotation awareness
      const line = lines[i];
      if (!line) continue;
      const values: string[] = [];
      let inQuotes = false;
      let curVal = '';

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(curVal.trim());
          curVal = '';
        } else {
          curVal += char;
        }
      }
      values.push(curVal.trim());

      const rowObj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = values[idx] || '';
      });
      rows.push(rowObj);
    }

    return rows;
  }

  /**
   * Imports unit rows into a project and generates a validation report.
   */
  async importUnits(
    companyId: string,
    projectId: string,
    input: { csvContent?: string; units?: BulkImportUnitRow[] },
  ): Promise<BulkImportReport> {
    // 1. Verify project exists
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.companyId, companyId), isNull(projects.deletedAt)));

    if (!project) {
      const err = new Error('Project not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    // 2. Extract rows
    let rawRows: Record<string, string | number | undefined>[] = [];
    if (input.csvContent) {
      const parsedCsv = BulkImportService.parseCsv(input.csvContent);
      rawRows = parsedCsv.map(r => ({
        tower: r.tower || r.block || r.building,
        floor: r.floor,
        unitNumber: r.unitnumber || r.unit || r.flatno || r.flat || r.apartment,
        bhk: r.bhk || r.config || r.type,
        carpetAreaSqft: r.carpetarea || r.carpetareasqft || r.sqft || r.area,
        superAreaSqft: r.superarea || r.superareasqft || r.builtuparea,
        price: r.price || r.cost || r.totalprice,
        status: r.status || 'available',
        facing: r.facing || r.direction,
        furnishing: r.furnishing,
      }));
    } else if (input.units && Array.isArray(input.units)) {
      rawRows = input.units;
    }

    const errors: Array<{ row: number; unitNumber?: string; error: string }> = [];
    const validUnitsToInsert: Array<{
      companyId: string;
      projectId: string;
      tower: string | null;
      floor: number | null;
      unitNumber: string;
      bhk: number;
      carpetAreaSqft: string;
      superAreaSqft: string | null;
      price: string;
      status: UnitStatus;
      facing: string | null;
      furnishing: string;
    }> = [];

    // Existing unit numbers for duplicate check
    const existingRows = await db
      .select({ unitNumber: units.unitNumber })
      .from(units)
      .where(and(eq(units.projectId, projectId), eq(units.companyId, companyId), isNull(units.deletedAt)));

    const existingUnitNumbers = new Set(existingRows.map(u => u.unitNumber.toLowerCase().trim()));
    const seenInBatch = new Set<string>();

    for (let i = 0; i < rawRows.length; i++) {
      const rowNum = i + 1;
      const row = rawRows[i];
      if (!row) continue;

      const unitNumber = String(row.unitNumber || '').trim();
      if (!unitNumber) {
        errors.push({ row: rowNum, error: 'Unit number is required' });
        continue;
      }

      const normalizedUnitNum = unitNumber.toLowerCase();
      if (existingUnitNumbers.has(normalizedUnitNum) || seenInBatch.has(normalizedUnitNum)) {
        errors.push({
          row: rowNum,
          unitNumber,
          error: `Duplicate unit number "${unitNumber}" already exists in project`,
        });
        continue;
      }
      seenInBatch.add(normalizedUnitNum);

      // Parse BHK
      const bhkRaw = String(row.bhk || '').replace(/bhk/i, '').trim();
      const bhk = parseInt(bhkRaw, 10);
      if (isNaN(bhk) || bhk <= 0 || bhk > 10) {
        errors.push({
          row: rowNum,
          unitNumber,
          error: `Invalid BHK configuration "${row.bhk}". Must be between 1 and 10.`,
        });
        continue;
      }

      // Parse Carpet Area
      const carpetAreaSqft = BulkImportService.parseArea(row.carpetAreaSqft);
      if (carpetAreaSqft <= 0) {
        errors.push({
          row: rowNum,
          unitNumber,
          error: `Invalid carpet area "${row.carpetAreaSqft}". Must be greater than 0.`,
        });
        continue;
      }

      // Parse Price
      const price = BulkImportService.parsePrice(row.price);
      if (price <= 0) {
        errors.push({
          row: rowNum,
          unitNumber,
          error: `Invalid unit price "${row.price}". Must be a positive amount.`,
        });
        continue;
      }

      const superAreaSqft = row.superAreaSqft ? BulkImportService.parseArea(row.superAreaSqft) : null;
      const floor = row.floor !== undefined && row.floor !== '' ? parseInt(String(row.floor), 10) : null;
      const statusRaw = String(row.status || 'available').toLowerCase();
      const status: UnitStatus = ['available', 'booked', 'sold', 'reserved'].includes(statusRaw)
        ? (statusRaw as UnitStatus)
        : 'available';

      validUnitsToInsert.push({
        companyId,
        projectId,
        tower: row.tower ? String(row.tower).trim() : null,
        floor: isNaN(Number(floor)) ? null : floor,
        unitNumber,
        bhk,
        carpetAreaSqft: String(carpetAreaSqft),
        superAreaSqft: superAreaSqft ? String(superAreaSqft) : null,
        price: String(price),
        status,
        facing: row.facing ? String(row.facing).trim() : null,
        furnishing: row.furnishing ? String(row.furnishing).trim() : 'unfurnished',
      });
    }

    // 3. Batch insert valid units in a transaction
    if (validUnitsToInsert.length > 0) {
      await db.transaction(async tx => {
        // Chunk inserts by 50 to avoid Postgres parameter limits
        const chunkSize = 50;
        for (let i = 0; i < validUnitsToInsert.length; i += chunkSize) {
          const chunk = validUnitsToInsert.slice(i, i + chunkSize);
          await tx.insert(units).values(chunk);
        }
      });
    }

    return {
      totalRows: rawRows.length,
      importedCount: validUnitsToInsert.length,
      failedCount: errors.length,
      errors,
    };
  }
}

export const bulkImportService = new BulkImportService();
