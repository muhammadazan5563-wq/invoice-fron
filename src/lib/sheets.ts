import { SpreadsheetInfo } from '../types';
import { apiJson } from './api';

export function extractSpreadsheetId(input: string): string {
  const clean = input.trim();
  const match = clean.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || clean;
}
export async function getSpreadsheetInfo(spreadsheetId: string, accessToken: string): Promise<SpreadsheetInfo> {
  return apiJson<SpreadsheetInfo>('/api/google/spreadsheet-info', { spreadsheetId: extractSpreadsheetId(spreadsheetId), accessToken });
}
