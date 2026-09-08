import * as XLSX from 'xlsx';
import { BadRequestError, ValidationError } from '../../core/errors/app-error.js';

export const ATTENDEE_IMPORT_COLUMNS = [
  'email',
  'full_name',
  'event_start_date',
  'membership_name',
] as const;

export type AttendeeImportColumn = (typeof ATTENDEE_IMPORT_COLUMNS)[number];

export interface ParsedAttendeeImportRow {
  rowNumber: number;
  email: string;
  fullName: string;
  eventStartDate: string;
  membershipName: string;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

/** Excel serial date → YYYY-MM-DD (UTC calendar day). */
function excelSerialToIsoDate(serial: number): string {
  const utc = XLSX.SSF.parse_date_code(serial);
  if (!utc) {
    throw new BadRequestError(`Invalid Excel date value: ${serial}`);
  }
  const y = String(utc.y).padStart(4, '0');
  const m = String(utc.m).padStart(2, '0');
  const d = String(utc.d).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function cellToStartDate(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return excelSerialToIsoDate(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  // Excel sometimes gives locale strings; prefer ISO first.
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (slash) {
    const month = slash[1]!.padStart(2, '0');
    const day = slash[2]!.padStart(2, '0');
    return `${slash[3]}-${month}-${day}`;
  }
  return raw;
}

/**
 * Parse + structural-validate an attendee import workbook.
 * Rejects the whole file if headers are wrong or any row is incomplete/invalid format.
 */
export function parseAttendeeImportWorkbook(buffer: Buffer): ParsedAttendeeImportRow[] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch {
    throw new BadRequestError('Could not read Excel file. Upload a valid .xlsx file.');
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new BadRequestError('Excel file has no sheets.');
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new BadRequestError('Excel file has no readable sheet.');
  }

  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null | undefined)[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  });

  if (matrix.length === 0) {
    throw new BadRequestError('Excel sheet is empty. Add the required header row and data.');
  }

  const headerRow = (matrix[0] ?? []).map(normalizeHeader).filter((h) => h.length > 0);
  const expected = [...ATTENDEE_IMPORT_COLUMNS];

  if (headerRow.length !== expected.length) {
    throw new ValidationError(
      [
        `Expected exactly these columns: ${expected.join(', ')}.`,
        `Found ${headerRow.length} column(s): ${headerRow.join(', ') || '(none)'}.`,
      ],
      'Excel columns are invalid',
    );
  }

  const missing = expected.filter((col) => !headerRow.includes(col));
  const unexpected = headerRow.filter((col) => !expected.includes(col as AttendeeImportColumn));
  if (missing.length > 0 || unexpected.length > 0) {
    const parts: string[] = [
      `Required columns (exact names): ${expected.join(', ')}.`,
    ];
    if (missing.length) parts.push(`Missing: ${missing.join(', ')}.`);
    if (unexpected.length) parts.push(`Unexpected: ${unexpected.join(', ')}.`);
    throw new ValidationError(parts, 'Excel columns are invalid');
  }

  const index = Object.fromEntries(
    expected.map((col) => [col, headerRow.indexOf(col)]),
  ) as Record<AttendeeImportColumn, number>;

  const rows: ParsedAttendeeImportRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < matrix.length; i += 1) {
    const raw = matrix[i] ?? [];
    const isBlank = expected.every((col) => {
      const v = raw[index[col]];
      return v === null || v === undefined || String(v).trim() === '';
    });
    if (isBlank) continue;

    const rowNumber = i + 1;
    const email = String(raw[index.email] ?? '')
      .trim()
      .toLowerCase();
    const fullName = String(raw[index.full_name] ?? '').trim();
    const eventStartDate = cellToStartDate(raw[index.event_start_date]);
    const membershipName = String(raw[index.membership_name] ?? '').trim();

    if (!email) errors.push(`Row ${rowNumber}: email is required.`);
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Row ${rowNumber}: invalid email "${email}".`);
    }

    if (!fullName || fullName.length < 2) {
      errors.push(`Row ${rowNumber}: full_name is required (min 2 characters).`);
    }

    if (!eventStartDate) {
      errors.push(`Row ${rowNumber}: event_start_date is required (YYYY-MM-DD).`);
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(eventStartDate)) {
      errors.push(
        `Row ${rowNumber}: event_start_date must be YYYY-MM-DD (got "${eventStartDate}").`,
      );
    }

    if (!membershipName) {
      errors.push(`Row ${rowNumber}: membership_name is required.`);
    }

    rows.push({
      rowNumber,
      email,
      fullName,
      eventStartDate,
      membershipName,
    });
  }

  if (rows.length === 0) {
    throw new BadRequestError('No attendee rows found. Add at least one data row.');
  }

  if (errors.length > 0) {
    throw new ValidationError(errors, 'Excel file has validation errors');
  }

  return rows;
}
