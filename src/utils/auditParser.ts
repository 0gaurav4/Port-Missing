import {
  RawAuditRow,
  ParsedPort,
  ParsedDeviceInfo,
  PortStatusItem,
  SwitchAuditGroup,
  RackAuditGroup,
  AuditAnalysisResult,
  SwitchModuleAudit,
  GenericParsedTable,
  ModuleMissingAudit,
} from '../types';

/**
 * Parses a device name into structured fields (Rack FNR, Switch S-number, Hostname, Domain)
 */
export function parseDeviceName(deviceName: string): ParsedDeviceInfo {
  const trimmed = (deviceName || '').trim();
  const parts = trimmed.split('.');
  const hostName = parts[0] || trimmed;
  const domain = parts.slice(1).join('.');

  // Extract Rack / FNR (e.g. FNR8, FNR-08, RACK5, FNR5)
  let rackId = 'Unknown-Rack';
  let rackNumber = '1';
  const fnrMatch = hostName.match(/FNR[-_]?(\d+[A-Za-z]*)/i) || hostName.match(/RACK[-_]?(\d+)/i);
  if (fnrMatch) {
    rackNumber = fnrMatch[1];
    rackId = `FNR${rackNumber}`;
  } else {
    // Try generic number patterns
    const numMatch = hostName.match(/R(\d+)/i);
    if (numMatch) {
      rackNumber = numMatch[1];
      rackId = `Rack-${rackNumber}`;
    }
  }

  // Extract Switch / S-number (e.g. AS1, SW1, S1)
  let switchId = 'AS1';
  let switchNumber = '1';
  const asMatch = hostName.match(/(?:AS|SW|S)[-_]?(\d+)/i);
  if (asMatch) {
    switchNumber = asMatch[1];
    switchId = `AS${switchNumber}`;
  }

  // Extract location/cluster (e.g. CCS1N1F1 before FNR)
  let locationCluster = '';
  const clusterMatch = hostName.match(/^(.*?)(?=FNR|RACK|AS)/i);
  if (clusterMatch && clusterMatch[1]) {
    locationCluster = clusterMatch[1];
  }

  return {
    rawDeviceName: trimmed,
    hostName,
    domain,
    rackId,
    rackNumber,
    switchId,
    switchNumber,
    locationCluster,
  };
}

/**
 * Parses a port string into structured interface details.
 * Supports: GigabitEthernet1/0/24, TenGigabitEthernet1/1/1, TwentyFiveGigE3/1/2, FortyGigabitEthernet3/1/1, etc.
 */
export function parsePortString(portStr: string): ParsedPort | null {
  if (!portStr) return null;
  const cleaned = portStr.trim();

  // Pattern: <InterfaceName><unit>/<module>/<port> e.g. GigabitEthernet1/0/45
  const threePartRegex = /^([A-Za-z0-9_-]+?)\s*(\d+)\/(\d+)\/(\d+)$/i;
  const threePartMatch = cleaned.match(threePartRegex);

  if (threePartMatch) {
    const rawType = threePartMatch[1];
    const unit = parseInt(threePartMatch[2], 10);
    const moduleSlot = parseInt(threePartMatch[3], 10);
    const portNum = parseInt(threePartMatch[4], 10);

    const { normalizedType, shortType, speed } = classifyInterfaceType(rawType);

    return {
      rawPort: cleaned,
      interfaceType: normalizedType,
      shortType,
      speedCategory: speed,
      switchUnit: unit,
      moduleSlot,
      portNumber: portNum,
      canonicalId: `${unit}/${moduleSlot}/${portNum}`,
    };
  }

  // Pattern: <InterfaceName><slot>/<port> e.g. GigabitEthernet0/24 or Gi1/1
  const twoPartRegex = /^([A-Za-z0-9_-]+?)\s*(\d+)\/(\d+)$/i;
  const twoPartMatch = cleaned.match(twoPartRegex);
  if (twoPartMatch) {
    const rawType = twoPartMatch[1];
    const unit = 1;
    const moduleSlot = parseInt(twoPartMatch[2], 10);
    const portNum = parseInt(twoPartMatch[3], 10);

    const { normalizedType, shortType, speed } = classifyInterfaceType(rawType);

    return {
      rawPort: cleaned,
      interfaceType: normalizedType,
      shortType,
      speedCategory: speed,
      switchUnit: unit,
      moduleSlot,
      portNumber: portNum,
      canonicalId: `${unit}/${moduleSlot}/${portNum}`,
    };
  }

  // Fallback: simple numeric or trailing number
  const numOnlyMatch = cleaned.match(/(\d+)$/);
  if (numOnlyMatch) {
    const portNum = parseInt(numOnlyMatch[1], 10);
    return {
      rawPort: cleaned,
      interfaceType: 'Ethernet',
      shortType: 'Eth',
      speedCategory: '1G',
      switchUnit: 1,
      moduleSlot: 0,
      portNumber: portNum,
      canonicalId: `1/0/${portNum}`,
    };
  }

  return null;
}

function classifyInterfaceType(rawType: string): {
  normalizedType: string;
  shortType: string;
  speed: '1G' | '10G' | '25G' | '40G' | '100G' | 'Other';
} {
  const lower = rawType.toLowerCase();

  if (lower.startsWith('forty') || lower.startsWith('fo') || lower.includes('40g')) {
    return { normalizedType: 'FortyGigabitEthernet', shortType: 'Fo', speed: '40G' };
  }
  if (lower.startsWith('twentyfive') || lower.startsWith('twe') || lower.includes('25g')) {
    return { normalizedType: 'TwentyFiveGigE', shortType: 'Twe', speed: '25G' };
  }
  if (lower.startsWith('hundred') || lower.startsWith('hu') || lower.includes('100g')) {
    return { normalizedType: 'HundredGigE', shortType: 'Hu', speed: '100G' };
  }
  if (lower.startsWith('ten') || lower.startsWith('te') || lower.includes('10g')) {
    return { normalizedType: 'TenGigabitEthernet', shortType: 'Te', speed: '10G' };
  }
  if (lower.startsWith('gigabit') || lower.startsWith('gi') || lower.includes('1g') || lower.startsWith('ge')) {
    return { normalizedType: 'GigabitEthernet', shortType: 'Gi', speed: '1G' };
  }
  if (lower.startsWith('fast') || lower.startsWith('fa')) {
    return { normalizedType: 'FastEthernet', shortType: 'Fa', speed: '1G' };
  }

  return { normalizedType: rawType, shortType: rawType.slice(0, 3), speed: 'Other' };
}

/**
 * Compresses an array of integer numbers into compact range format:
 * e.g. [1, 2, 3, 5, 7, 8, 9] -> "1-3, 5, 7-9"
 */
export function formatNumberRanges(numbers: number[]): string {
  if (!numbers || numbers.length === 0) return 'None';

  const sorted = Array.from(new Set(numbers)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = start;

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    if (curr === prev + 1) {
      prev = curr;
    } else {
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = curr;
      prev = curr;
    }
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return ranges.join(', ');
}

export type SwitchCapacityMode = 'auto' | 24 | 48;

/**
 * Core Network Audit Engine:
 * Analyzes raw audit rows, groups by Rack (FNR) & Switch (S-number),
 * calculates configured ports and detects MISSING ports in sequence.
 */
export function analyzeAuditData(
  records: RawAuditRow[],
  capacityMode: SwitchCapacityMode = 'auto'
): AuditAnalysisResult {
  if (!records || records.length === 0) {
    return {
      totalRecords: 0,
      racks: [],
      allSwitches: [],
      allMissingPorts: [],
      rackIds: [],
      totalExpectedPorts: 0,
      totalConfiguredPorts: 0,
      totalMissingPorts: 0,
      coveragePercentage: 0,
    };
  }

  // 1. Group records by Rack and Device
  const rackMap = new Map<string, {
    rackInfo: ParsedDeviceInfo;
    deviceMap: Map<string, {
      deviceInfo: ParsedDeviceInfo;
      ports: Array<{ parsed: ParsedPort; row: RawAuditRow }>;
    }>;
  }>();

  for (const row of records) {
    if (!row.deviceName || !row.port) continue;
    const devInfo = parseDeviceName(row.deviceName);
    const parsedPort = parsePortString(row.port);
    if (!parsedPort) continue;

    if (!rackMap.has(devInfo.rackId)) {
      rackMap.set(devInfo.rackId, {
        rackInfo: devInfo,
        deviceMap: new Map(),
      });
    }

    const rackGroup = rackMap.get(devInfo.rackId)!;
    if (!rackGroup.deviceMap.has(devInfo.rawDeviceName)) {
      rackGroup.deviceMap.set(devInfo.rawDeviceName, {
        deviceInfo: devInfo,
        ports: [],
      });
    }

    rackGroup.deviceMap.get(devInfo.rawDeviceName)!.ports.push({
      parsed: parsedPort,
      row,
    });
  }

  const rackAuditGroups: RackAuditGroup[] = [];
  const allSwitchAuditGroups: SwitchAuditGroup[] = [];
  const globalMissingPorts: PortStatusItem[] = [];

  // 2. Analyze each rack
  for (const [rackId, { rackInfo, deviceMap }] of rackMap.entries()) {
    const switchGroupsInRack: SwitchAuditGroup[] = [];
    const deviceNamesInRack: string[] = [];

    for (const [devName, { deviceInfo, ports }] of deviceMap.entries()) {
      deviceNamesInRack.push(devName);

      // In enterprise stack switches (e.g. Cisco 3850/9300), each device hostname
      // can represent a stack of switch units (Unit 1, Unit 2, Unit 3).
      // Let's identify all switch units present in the ports.
      const unitMap = new Map<number, Array<{ parsed: ParsedPort; row: RawAuditRow }>>();

      for (const item of ports) {
        const u = item.parsed.switchUnit || 1;
        if (!unitMap.has(u)) {
          unitMap.set(u, []);
        }
        unitMap.get(u)!.push(item);
      }

      // If no unit found, default unit 1
      if (unitMap.size === 0) {
        unitMap.set(1, []);
      }

      // Process each Switch Unit (e.g. Unit 1, Unit 2, Unit 3)
      const sortedUnits = Array.from(unitMap.keys()).sort((a, b) => a - b);

      for (const unitNum of sortedUnits) {
        const unitPorts = unitMap.get(unitNum) || [];

        // Distinguish base ports (moduleSlot == 0) and uplink/expansion ports (moduleSlot > 0)
        const basePortsMap = new Map<number, { parsed: ParsedPort; row: RawAuditRow }>();
        const uplinkPortsMap = new Map<string, { parsed: ParsedPort; row: RawAuditRow }>();

        let maxBasePortSeen = 0;
        let maxUplinkPortSeen = 0;

        for (const item of unitPorts) {
          if (item.parsed.moduleSlot === 0) {
            basePortsMap.set(item.parsed.portNumber, item);
            if (item.parsed.portNumber > maxBasePortSeen) {
              maxBasePortSeen = item.parsed.portNumber;
            }
          } else {
            const key = `${item.parsed.moduleSlot}/${item.parsed.portNumber}`;
            uplinkPortsMap.set(key, item);
            if (item.parsed.portNumber > maxUplinkPortSeen) {
              maxUplinkPortSeen = item.parsed.portNumber;
            }
          }
        }

        // Determine base capacity
        let baseCapacity: number;
        if (capacityMode === 24) {
          baseCapacity = 24;
        } else if (capacityMode === 48) {
          baseCapacity = 48;
        } else {
          // Auto mode: if max base port > 24, standard switch is 48 ports. Else if > 0, standard is 24 or 48.
          // Standard enterprise access switches in data centers are overwhelmingly 48-port or 24-port.
          if (maxBasePortSeen > 24) {
            baseCapacity = 48;
          } else if (maxBasePortSeen > 12) {
            baseCapacity = 24;
          } else if (maxBasePortSeen > 0) {
            baseCapacity = 24;
          } else {
            baseCapacity = 48;
          }
        }

        const switchPortsList: PortStatusItem[] = [];
        const missingBaseNumbers: number[] = [];

        // Build base ports (1 to baseCapacity)
        for (let p = 1; p <= baseCapacity; p++) {
          const found = basePortsMap.get(p);
          if (found) {
            switchPortsList.push({
              portId: found.parsed.rawPort,
              canonicalId: found.parsed.canonicalId,
              portNumber: p,
              switchUnit: unitNum,
              moduleSlot: 0,
              interfaceType: found.parsed.interfaceType,
              speedCategory: found.parsed.speedCategory,
              isConfigured: true,
              isMissing: false,
              isUplink: false,
              auditSlNo: found.row.slNo,
              deviceName: devName,
              rackId: deviceInfo.rackId,
              switchId: `${deviceInfo.switchId}-U${unitNum}`,
            });
          } else {
            missingBaseNumbers.push(p);
            const missingItem: PortStatusItem = {
              portId: `GigabitEthernet${unitNum}/0/${p}`,
              canonicalId: `${unitNum}/0/${p}`,
              portNumber: p,
              switchUnit: unitNum,
              moduleSlot: 0,
              interfaceType: 'GigabitEthernet',
              speedCategory: '1G',
              isConfigured: false,
              isMissing: true,
              isUplink: false,
              deviceName: devName,
              rackId: deviceInfo.rackId,
              switchId: `${deviceInfo.switchId}-U${unitNum}`,
            };
            switchPortsList.push(missingItem);
            globalMissingPorts.push(missingItem);
          }
        }

        // Handle Uplink / Expansion modules (moduleSlot >= 1)
        // Standard Cisco network modules have 2 or 4 ports (e.g. 4x10G, 4x25G, 2x40G)
        const uplinkModulesMap = new Map<number, Array<{ parsed: ParsedPort; row: RawAuditRow }>>();
        for (const item of unitPorts) {
          if (item.parsed.moduleSlot > 0) {
            const slot = item.parsed.moduleSlot;
            if (!uplinkModulesMap.has(slot)) {
              uplinkModulesMap.set(slot, []);
            }
            uplinkModulesMap.get(slot)!.push(item);
          }
        }

        let totalUplinkPorts = 0;
        let configuredUplinkCount = 0;
        let missingUplinkCount = 0;
        const switchModules: SwitchModuleAudit[] = [];

        // For each observed expansion slot (e.g. slot 1)
        for (const [slotNum, slotPorts] of uplinkModulesMap.entries()) {
          const maxSlotPort = Math.max(...slotPorts.map(sp => sp.parsed.portNumber), 2);
          const slotCapacity = maxSlotPort <= 2 ? 2 : 4; // 2 or 4 uplink ports standard
          const primaryType = slotPorts[0]?.parsed.interfaceType || 'TenGigabitEthernet';
          const primarySpeed = slotPorts[0]?.parsed.speedCategory || '10G';

          const slotPortsList: PortStatusItem[] = [];
          const slotMissingList: PortStatusItem[] = [];
          const slotConfiguredList: PortStatusItem[] = [];
          const slotMissingNums: number[] = [];

          for (let up = 1; up <= slotCapacity; up++) {
            totalUplinkPorts++;
            const foundUplink = slotPorts.find(sp => sp.parsed.portNumber === up);
            if (foundUplink) {
              configuredUplinkCount++;
              const item: PortStatusItem = {
                portId: foundUplink.parsed.rawPort,
                canonicalId: foundUplink.parsed.canonicalId,
                portNumber: up,
                switchUnit: unitNum,
                moduleSlot: slotNum,
                interfaceType: foundUplink.parsed.interfaceType,
                speedCategory: foundUplink.parsed.speedCategory,
                isConfigured: true,
                isMissing: false,
                isUplink: true,
                auditSlNo: foundUplink.row.slNo,
                deviceName: devName,
                rackId: deviceInfo.rackId,
                switchId: `${deviceInfo.switchId}-U${unitNum}`,
              };
              slotPortsList.push(item);
              slotConfiguredList.push(item);
              switchPortsList.push(item);
            } else {
              missingUplinkCount++;
              slotMissingNums.push(up);
              const missingItem: PortStatusItem = {
                portId: `${primaryType}${unitNum}/${slotNum}/${up}`,
                canonicalId: `${unitNum}/${slotNum}/${up}`,
                portNumber: up,
                switchUnit: unitNum,
                moduleSlot: slotNum,
                interfaceType: primaryType,
                speedCategory: primarySpeed,
                isConfigured: false,
                isMissing: true,
                isUplink: true,
                deviceName: devName,
                rackId: deviceInfo.rackId,
                switchId: `${deviceInfo.switchId}-U${unitNum}`,
              };
              slotPortsList.push(missingItem);
              slotMissingList.push(missingItem);
              switchPortsList.push(missingItem);
              globalMissingPorts.push(missingItem);
            }
          }

          switchModules.push({
            moduleSlot: slotNum,
            interfaceType: primaryType,
            speedCategory: primarySpeed,
            totalPorts: slotCapacity,
            configuredPorts: slotConfiguredList,
            missingPorts: slotMissingList,
            allPorts: slotPortsList,
            missingRangesText: formatNumberRanges(slotMissingNums),
          });
        }

        const configuredBaseCount = baseCapacity - missingBaseNumbers.length;
        const missingBaseCount = missingBaseNumbers.length;
        const totalPorts = baseCapacity + totalUplinkPorts;
        const totalConfigured = configuredBaseCount + configuredUplinkCount;
        const totalMissing = missingBaseCount + missingUplinkCount;
        const utilizationRate = totalPorts > 0 ? Math.round((totalConfigured / totalPorts) * 1000) / 10 : 0;

        const switchGroupId = `${deviceInfo.rackId}-${deviceInfo.switchId}-U${unitNum}`;
        const switchLabel = `Rack ${deviceInfo.rackId} • Switch ${deviceInfo.switchId} (Unit ${unitNum})`;

        const switchAudit: SwitchAuditGroup = {
          id: switchGroupId,
          rackId: deviceInfo.rackId,
          rackNumber: deviceInfo.rackNumber,
          switchId: `${deviceInfo.switchId}-U${unitNum}`,
          switchUnit: unitNum,
          deviceName: devName,
          label: switchLabel,
          baseCapacity,
          totalBasePorts: baseCapacity,
          configuredBaseCount,
          missingBaseCount,
          missingBaseNumbers,
          missingBaseRangesText: formatNumberRanges(missingBaseNumbers),
          totalUplinkPorts,
          configuredUplinkCount,
          missingUplinkCount,
          totalPorts,
          configuredCount: totalConfigured,
          missingCount: totalMissing,
          utilizationRate,
          ports: switchPortsList,
          modules: switchModules,
        };

        switchGroupsInRack.push(switchAudit);
        allSwitchAuditGroups.push(switchAudit);
      }
    }

    const rackTotalExpected = switchGroupsInRack.reduce((acc, s) => acc + s.totalPorts, 0);
    const rackTotalConfigured = switchGroupsInRack.reduce((acc, s) => acc + s.configuredCount, 0);
    const rackTotalMissing = switchGroupsInRack.reduce((acc, s) => acc + s.missingCount, 0);
    const rackUtil = rackTotalExpected > 0 ? Math.round((rackTotalConfigured / rackTotalExpected) * 1000) / 10 : 0;

    rackAuditGroups.push({
      rackId,
      rackNumber: rackInfo.rackNumber,
      devices: Array.from(new Set(deviceNamesInRack)),
      totalSwitches: switchGroupsInRack.length,
      totalExpectedPorts: rackTotalExpected,
      totalConfiguredPorts: rackTotalConfigured,
      totalMissingPorts: rackTotalMissing,
      overallUtilization: rackUtil,
      switches: switchGroupsInRack,
    });
  }

  // Sort racks naturally (e.g. FNR5 before FNR8)
  rackAuditGroups.sort((a, b) => {
    const numA = parseInt(a.rackNumber, 10) || 0;
    const numB = parseInt(b.rackNumber, 10) || 0;
    return numA - numB;
  });

  const totalExpectedPorts = rackAuditGroups.reduce((acc, r) => acc + r.totalExpectedPorts, 0);
  const totalConfiguredPorts = rackAuditGroups.reduce((acc, r) => acc + r.totalConfiguredPorts, 0);
  const totalMissingPorts = rackAuditGroups.reduce((acc, r) => acc + r.totalMissingPorts, 0);
  const coveragePercentage = totalExpectedPorts > 0 ? Math.round((totalConfiguredPorts / totalExpectedPorts) * 1000) / 10 : 0;

  return {
    totalRecords: records.length,
    racks: rackAuditGroups,
    allSwitches: allSwitchAuditGroups,
    allMissingPorts: globalMissingPorts,
    rackIds: rackAuditGroups.map(r => r.rackId),
    totalExpectedPorts,
    totalConfiguredPorts,
    totalMissingPorts,
    coveragePercentage,
  };
}

/**
 * Parses raw text input from clipboard (TSV / CSV / comma / tab delimited)
 */
export function parseRawTextInput(rawText: string): RawAuditRow[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) return [];

  // Check header line
  const firstLine = lines[0].toLowerCase();
  const hasHeader =
    firstLine.includes('device') ||
    firstLine.includes('port') ||
    firstLine.includes('sl.no') ||
    firstLine.includes('hostname') ||
    firstLine.includes('switch');

  const startIndex = hasHeader ? 1 : 0;
  const rows: RawAuditRow[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    // Determine delimiter: tab, comma, or multiple spaces
    let parts: string[] = [];
    if (line.includes('\t')) {
      parts = line.split('\t');
    } else if (line.includes(',')) {
      parts = line.split(',');
    } else if (line.includes(';')) {
      parts = line.split(';');
    } else {
      // Split on 2 or more spaces
      parts = line.split(/\s{2,}/);
      if (parts.length < 2) {
        // Fallback single space if port keyword found
        const portIndex = line.search(/(?:Gigabit|TenGigabit|TwentyFive|Forty|Hundred|Ethernet|\d+\/\d+)/i);
        if (portIndex > 0) {
          parts = [line.slice(0, portIndex).trim(), line.slice(portIndex).trim()];
        }
      }
    }

    parts = parts.map(p => p.trim().replace(/^["']|["']$/g, ''));
    if (parts.length === 0) continue;

    let slNo: number | string | undefined = undefined;
    let deviceName = '';
    let port = '';

    if (parts.length >= 3) {
      // Common format: Sl.No, Device Name, Port
      slNo = parts[0];
      deviceName = parts[1];
      port = parts[2];
    } else if (parts.length === 2) {
      // Format: Device Name, Port OR Sl.No, Port
      if (/^\d+$/.test(parts[0]) && parts[1].includes('/')) {
        slNo = parts[0];
        port = parts[1];
        deviceName = 'Unknown-Device';
      } else {
        deviceName = parts[0];
        port = parts[1];
      }
    } else if (parts.length === 1 && parts[0].includes('/')) {
      port = parts[0];
      deviceName = 'Unknown-Device';
    }

    if (deviceName && port) {
      rows.push({
        slNo: slNo || rows.length + 1,
        deviceName,
        port,
      });
    }
  }

  return rows;
}

/**
 * Parses generic tabular output (like Cisco CLI or spreadsheets) into a dataframe structure
 */
export function parseGenericTableData(rawText: string): GenericParsedTable {
  if (!rawText || !rawText.trim()) {
    return {
      headers: [],
      rows: [],
      totalRows: 0,
      totalColumns: 0,
      portColumnIndex: -1,
      portColumnName: '',
    };
  }

  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    return {
      headers: [],
      rows: [],
      totalRows: 0,
      totalColumns: 0,
      portColumnIndex: -1,
      portColumnName: '',
    };
  }

  // Helper to split a line by tab, comma, semicolon or multiple whitespace
  const splitLine = (line: string): string[] => {
    if (line.includes('\t')) {
      return line.split('\t').map(c => c.trim().replace(/^["']|["']$/g, ''));
    }
    if (line.includes(',') && !line.includes(' ')) {
      return line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    }
    // Check if line has multiple spaces or single space between distinct tokens
    const multiSpaceSplit = line.split(/\s{2,}/).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (multiSpaceSplit.length > 1) {
      return multiSpaceSplit;
    }
    // Fallback: split by single whitespace
    return line.split(/\s+/).map(c => c.trim().replace(/^["']|["']$/g, ''));
  };

  const rawParsedLines = lines.map(splitLine);
  const maxCols = Math.max(...rawParsedLines.map(cols => cols.length));

  if (maxCols === 0) {
    return {
      headers: [],
      rows: [],
      totalRows: 0,
      totalColumns: 0,
      portColumnIndex: -1,
      portColumnName: '',
    };
  }

  // Check if first line is a header
  const firstLineCols = rawParsedLines[0];
  const firstLineLower = firstLineCols.map(c => c.toLowerCase());
  const isLikelyHeader =
    firstLineLower.some(c => c === 'port' || c === 'interface' || c === 'device' || c === 'hostname' || c === 'action' || c === 'status' || c.includes('sl.no') || c === 'vlan');

  let headers: string[] = [];
  let dataLines: string[][] = [];

  if (isLikelyHeader) {
    headers = firstLineCols;
    // Fill in missing header names if any row had more columns
    for (let c = headers.length; c < maxCols; c++) {
      headers.push(`Col${c + 1}`);
    }
    dataLines = rawParsedLines.slice(1);
  } else {
    // Generate headers like the screenshot: [Port, Col2, Col3, Col4, Action]
    dataLines = rawParsedLines;
    headers = [];
    for (let c = 0; c < maxCols; c++) {
      if (c === 0) {
        headers.push('Port');
      } else if (c === maxCols - 1 && (dataLines[0]?.[c]?.match(/^(Restrict|Shutdown|Protect|Up|Down|Connected)$/i))) {
        headers.push('Action');
      } else {
        headers.push(`Col${c + 1}`);
      }
    }
  }

  // Identify which column has ports
  let portColIdx = -1;
  // First check headers
  for (let c = 0; c < headers.length; c++) {
    const h = headers[c].toLowerCase();
    if (h === 'port' || h === 'interface' || h === 'intf') {
      portColIdx = c;
      break;
    }
  }

  // If not found in headers, check column values for Cisco port patterns like Gi1/0/1 or 1/0/1
  if (portColIdx === -1) {
    for (let c = 0; c < maxCols; c++) {
      const matchCount = dataLines.slice(0, 10).filter(row => {
        const val = row[c] || '';
        return /(?:[A-Za-z]+\s*\d+\/\d+|\b\d+\/\d+\/\d+\b)/i.test(val);
      }).length;
      if (matchCount >= 2) {
        portColIdx = c;
        // Rename header to 'Port' if it was generic
        if (headers[c].startsWith('Col')) {
          headers[c] = 'Port';
        }
        break;
      }
    }
  }

  if (portColIdx === -1) {
    portColIdx = 0; // Default to first column
  }

  // Identify device name column if any
  let deviceColIdx = -1;
  for (let c = 0; c < headers.length; c++) {
    const h = headers[c].toLowerCase();
    if (h.includes('device') || h.includes('host') || h.includes('switch')) {
      deviceColIdx = c;
      break;
    }
  }

  if (deviceColIdx === -1) {
    for (let c = 0; c < maxCols; c++) {
      if (c === portColIdx) continue;
      const matchCount = dataLines.slice(0, 10).filter(row => {
        const val = row[c] || '';
        return /FNR|RACK|\.nic\.in|\.local|\.com|[A-Z]{3,}\d+/i.test(val);
      }).length;
      if (matchCount >= 2) {
        deviceColIdx = c;
        break;
      }
    }
  }

  // Construct structured rows
  const structuredRows: Record<string, string>[] = [];
  dataLines.forEach(lineCols => {
    if (lineCols.length === 0 || (lineCols.length === 1 && !lineCols[0])) return;
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = lineCols[idx] !== undefined ? lineCols[idx] : '';
    });
    structuredRows.push(rowObj);
  });

  return {
    headers,
    rows: structuredRows,
    totalRows: structuredRows.length,
    totalColumns: headers.length,
    portColumnIndex: portColIdx,
    portColumnName: headers[portColIdx] || 'Port',
    deviceColumnIndex: deviceColIdx >= 0 ? deviceColIdx : undefined,
    deviceColumnName: deviceColIdx >= 0 ? headers[deviceColIdx] : undefined,
  };
}

/**
 * Analyzes parsed generic table rows to identify missing port numbers per module/switch
 */
export function analyzeModulesMissingPorts(
  table: GenericParsedTable,
  capacityMode: SwitchCapacityMode = 'auto'
): {
  modules: ModuleMissingAudit[];
  totalMissingPorts: number;
  modulesWithMissingCount: number;
  totalConfiguredPorts: number;
  totalExpectedPorts: number;
} {
  if (!table || table.rows.length === 0 || table.portColumnIndex < 0) {
    return {
      modules: [],
      totalMissingPorts: 0,
      modulesWithMissingCount: 0,
      totalConfiguredPorts: 0,
      totalExpectedPorts: 0,
    };
  }

  const portCol = table.portColumnName;
  const devCol = table.deviceColumnName;

  // Group ports by module prefix (e.g. Gi1/0, Gi2/0, Gi3/0, Te1/1, etc.)
  // and device if present
  interface ModuleGroupData {
    moduleId: string;
    modulePrefix: string;
    deviceName?: string;
    rackId?: string;
    switchId?: string;
    switchUnit: number;
    moduleSlot: number;
    interfaceType: string;
    configuredPortsMap: Map<number, string>;
    maxPortSeen: number;
  }

  const moduleMap = new Map<string, ModuleGroupData>();

  table.rows.forEach((row: Record<string, string>) => {
    const rawPortStr = row[portCol] || '';
    if (!rawPortStr) return;

    const parsedPort = parsePortString(rawPortStr);
    if (!parsedPort) return;

    const rawDevStr = devCol ? row[devCol] : undefined;
    let devInfo: ParsedDeviceInfo | undefined = undefined;
    if (rawDevStr) {
      devInfo = parseDeviceName(rawDevStr);
    }

    // Determine module prefix: e.g. "Gi1/0" or "Te1/1"
    const prefix = `${parsedPort.shortType}${parsedPort.switchUnit}/${parsedPort.moduleSlot}`;
    const key = devInfo
      ? `${devInfo.rackId}-${devInfo.switchId}-${prefix}`
      : prefix;

    if (!moduleMap.has(key)) {
      moduleMap.set(key, {
        moduleId: key,
        modulePrefix: prefix,
        deviceName: devInfo?.rawDeviceName,
        rackId: devInfo?.rackId,
        switchId: devInfo?.switchId,
        switchUnit: parsedPort.switchUnit,
        moduleSlot: parsedPort.moduleSlot,
        interfaceType: parsedPort.interfaceType,
        configuredPortsMap: new Map(),
        maxPortSeen: 0,
      });
    }

    const group = moduleMap.get(key)!;
    group.configuredPortsMap.set(parsedPort.portNumber, parsedPort.rawPort);
    if (parsedPort.portNumber > group.maxPortSeen) {
      group.maxPortSeen = parsedPort.portNumber;
    }
  });

  const modulesList: ModuleMissingAudit[] = [];
  let globalMissingCount = 0;
  let globalConfiguredCount = 0;
  let globalExpectedCount = 0;
  let modulesWithMissing = 0;

  moduleMap.forEach(group => {
    // Determine capacity: 24, 48, or auto
    let capacity: number;
    if (capacityMode === 24) {
      capacity = 24;
    } else if (capacityMode === 48) {
      capacity = 48;
    } else {
      // Auto:
      if (group.maxPortSeen > 24) {
        capacity = 48;
      } else if (group.maxPortSeen > 4) {
        capacity = 24;
      } else {
        // Uplink cages (usually 2 or 4 ports)
        capacity = group.maxPortSeen <= 2 ? 2 : 4;
      }
    }

    const configuredNums: number[] = [];
    const missingNums: number[] = [];
    const missingStrings: string[] = [];
    const allStatuses: {
      portNumber: number;
      portName: string;
      isConfigured: boolean;
      isMissing: boolean;
    }[] = [];

    for (let p = 1; p <= capacity; p++) {
      const portName = `${group.modulePrefix}/${p}`;
      if (group.configuredPortsMap.has(p)) {
        configuredNums.push(p);
        allStatuses.push({
          portNumber: p,
          portName,
          isConfigured: true,
          isMissing: false,
        });
      } else {
        missingNums.push(p);
        missingStrings.push(portName);
        allStatuses.push({
          portNumber: p,
          portName,
          isConfigured: false,
          isMissing: true,
        });
      }
    }

    const missingRangesText = formatNumberRanges(missingNums);

    // Build Cisco CLI interface range command
    // e.g. "interface range GigabitEthernet1/0/5 - 6, GigabitEthernet1/0/13"
    let ciscoRangeCommand = '';
    if (missingNums.length > 0) {
      const ranges = missingRangesText.split(', ').map(r => {
        if (r.includes('-')) {
          const [start, end] = r.split('-');
          return `${group.interfaceType}${group.switchUnit}/${group.moduleSlot}/${start} - ${end}`;
        }
        return `${group.interfaceType}${group.switchUnit}/${group.moduleSlot}/${r}`;
      });
      ciscoRangeCommand = `interface range ${ranges.join(', ')}`;
    }

    if (missingNums.length > 0) {
      modulesWithMissing++;
    }

    globalMissingCount += missingNums.length;
    globalConfiguredCount += configuredNums.length;
    globalExpectedCount += capacity;

    modulesList.push({
      moduleId: group.moduleId,
      modulePrefix: group.modulePrefix,
      deviceName: group.deviceName,
      rackId: group.rackId,
      switchId: group.switchId,
      switchUnit: group.switchUnit,
      moduleSlot: group.moduleSlot,
      capacity,
      configuredPortNumbers: configuredNums,
      missingPortNumbers: missingNums,
      missingPortStrings: missingStrings,
      missingRangesText,
      allPortStatuses: allStatuses,
      ciscoRangeCommand,
    });
  });

  // Sort modules naturally: e.g. Gi1/0, Gi2/0, Gi3/0
  modulesList.sort((a, b) => {
    if (a.rackId && b.rackId && a.rackId !== b.rackId) {
      return a.rackId.localeCompare(b.rackId);
    }
    if (a.switchUnit !== b.switchUnit) {
      return a.switchUnit - b.switchUnit;
    }
    return a.moduleSlot - b.moduleSlot;
  });

  return {
    modules: modulesList,
    totalMissingPorts: globalMissingCount,
    modulesWithMissingCount: modulesWithMissing,
    totalConfiguredPorts: globalConfiguredCount,
    totalExpectedPorts: globalExpectedCount,
  };
}

