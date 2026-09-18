export interface GenericParsedTable {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  totalColumns: number;
  portColumnIndex: number;
  portColumnName: string;
  deviceColumnIndex?: number;
  deviceColumnName?: string;
  operStatusColumnIndex?: number;
  operStatusColumnName?: string;
  adminStatusColumnIndex?: number;
  adminStatusColumnName?: string;
  descriptionColumnIndex?: number;
  descriptionColumnName?: string;
  ipColumnIndex?: number;
  ipColumnName?: string;
  macColumnIndex?: number;
  macColumnName?: string;
}

export interface PortAuditDetail {
  portNumber: number;
  portName: string;
  isConfigured: boolean;
  isMissing: boolean;
  status: 'up' | 'down' | 'missing';
  adminStatus?: string;
  operStatus?: string;
  description?: string;
  macAddress?: string;
  ipAddress?: string;
  lastInput?: string;
  lastOutput?: string;
  rawRow?: Record<string, string>;
}

export interface ModuleMissingAudit {
  moduleId: string;            // e.g. "FNR8-AS1-Gi1/0"
  modulePrefix: string;        // e.g. "Gi1/0"
  deviceName?: string;         // e.g. "CCS1N1F1FNR8AS1.cgv.nic.in"
  rackId?: string;             // e.g. "FNR8"
  switchId?: string;           // e.g. "AS1"
  switchUnit: number;          // e.g. 1
  moduleSlot: number;          // e.g. 0
  capacity: number;            // e.g. 48
  configuredPortNumbers: number[];
  missingPortNumbers: number[];
  missingPortStrings: string[];
  missingRangesText: string;
  upPortNumbers: number[];
  downPortNumbers: number[];
  upPortStrings: string[];
  downPortStrings: string[];
  allPortStatuses: PortAuditDetail[];
  ciscoRangeCommand: string;
}

export interface RackAuditSummary {
  rackId: string;              // e.g. "FNR8"
  rackNumber: string;          // e.g. "8"
  devices: string[];
  totalExpectedPorts: number;
  totalConfiguredPorts: number;
  totalMissingPorts: number;
  totalUpPorts: number;
  totalDownPorts: number;
  missingRangesText: string;
  downPortsText: string;
  modules: ModuleMissingAudit[];
}

export interface ComprehensiveAuditAnalysis {
  modules: ModuleMissingAudit[];
  racks: RackAuditSummary[];
  totalMissingPorts: number;
  totalDownPorts: number;
  totalUpPorts: number;
  totalConfiguredPorts: number;
  totalExpectedPorts: number;
  modulesWithMissingCount: number;
}

export interface RawAuditRow {
  slNo?: number | string;
  deviceName: string;
  port: string;
  status?: string;
  description?: string;
}

export interface ParsedPort {
  rawPort: string;
  interfaceType: string; // e.g. GigabitEthernet, TenGigabitEthernet, TwentyFiveGigE, FortyGigabitEthernet
  shortType: string;     // e.g. Gi, Te, Twe, Fo
  speedCategory: '1G' | '10G' | '25G' | '40G' | '100G' | 'Other';
  switchUnit: number;    // e.g. 1, 2, 3 (from 1/0/24)
  moduleSlot: number;    // e.g. 0 (base), 1 (uplink/expansion)
  portNumber: number;    // e.g. 24
  canonicalId: string;   // e.g. "1/0/24"
}

export interface ParsedDeviceInfo {
  rawDeviceName: string;
  hostName: string;
  domain: string;
  rackId: string;       // e.g. "FNR8", "FNR5"
  rackNumber: string;   // e.g. "8", "5"
  switchId: string;     // e.g. "AS1", "S1"
  switchNumber: string; // e.g. "1"
  locationCluster: string; // e.g. "CCS1N1F1"
}

export interface PortStatusItem {
  portId: string;             // e.g. "GigabitEthernet1/0/2"
  canonicalId: string;        // e.g. "1/0/2"
  portNumber: number;         // e.g. 2
  switchUnit: number;         // e.g. 1
  moduleSlot: number;         // e.g. 0
  interfaceType: string;      // e.g. "GigabitEthernet"
  speedCategory: '1G' | '10G' | '25G' | '40G' | '100G' | 'Other';
  isConfigured: boolean;      // true if in audit data
  isMissing: boolean;         // true if missing from sequence
  isUplink: boolean;          // true if moduleSlot > 0 or dedicated 10G/25G/40G
  auditSlNo?: number | string;
  deviceName: string;
  rackId: string;
  switchId: string;
}

export interface SwitchModuleAudit {
  moduleSlot: number;
  interfaceType: string;
  speedCategory: '1G' | '10G' | '25G' | '40G' | '100G' | 'Other';
  totalPorts: number;
  configuredPorts: PortStatusItem[];
  missingPorts: PortStatusItem[];
  allPorts: PortStatusItem[];
  missingRangesText: string;
}

export interface SwitchAuditGroup {
  id: string;                 // unique key e.g. "FNR8-AS1-Unit1"
  rackId: string;             // e.g. "FNR8"
  rackNumber: string;         // e.g. "8"
  switchId: string;           // e.g. "AS1"
  switchUnit: number;         // e.g. 1 (from port string 1/0/x)
  deviceName: string;         // e.g. "CCS1N1F1FNR8AS1.cgv.nic.in"
  label: string;              // e.g. "Rack FNR 8 • Switch AS1 (Unit 1)"
  baseCapacity: number;       // e.g. 48 or 24
  totalBasePorts: number;
  configuredBaseCount: number;
  missingBaseCount: number;
  missingBaseNumbers: number[];
  missingBaseRangesText: string;
  
  // Uplinks/Network Modules
  totalUplinkPorts: number;
  configuredUplinkCount: number;
  missingUplinkCount: number;
  
  // Aggregated
  totalPorts: number;
  configuredCount: number;
  missingCount: number;
  utilizationRate: number;    // %
  
  // Detailed ports
  ports: PortStatusItem[];
  modules: SwitchModuleAudit[];
}

export interface RackAuditGroup {
  rackId: string;             // e.g. "FNR8"
  rackNumber: string;         // e.g. "8"
  devices: string[];          // list of distinct device names in this rack
  totalSwitches: number;      // number of switch units
  totalExpectedPorts: number;
  totalConfiguredPorts: number;
  totalMissingPorts: number;
  overallUtilization: number;
  switches: SwitchAuditGroup[];
}

export interface AuditAnalysisResult {
  totalRecords: number;
  racks: RackAuditGroup[];
  allSwitches: SwitchAuditGroup[];
  allMissingPorts: PortStatusItem[];
  rackIds: string[];
  totalExpectedPorts: number;
  totalConfiguredPorts: number;
  totalMissingPorts: number;
  coveragePercentage: number;
}
