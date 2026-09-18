// Datacenter Audit Log containing Rack (FNR Number) and Switch (S-Number) entries
import { SAMPLE_AUDIT_DATA } from './sampleAuditData';

export const SAMPLE_DATACENTER_AUDIT_TEXT = [
  'Sl.No\tDevice Name\tPort',
  ...SAMPLE_AUDIT_DATA.map(
    row => `${row.slNo}\t${row.deviceName}\t${row.port}`
  ),
].join('\n');
