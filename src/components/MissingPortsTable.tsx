import React, { useState, useMemo } from 'react';
import { SwitchAuditGroup, PortStatusItem, RackAuditGroup } from '../types';
import {
  AlertTriangle,
  Search,
  Download,
  Copy,
  Check,
  Filter,
  ExternalLink,
  CheckCircle2,
  Table as TableIcon,
} from 'lucide-react';

interface MissingPortsTableProps {
  switches: SwitchAuditGroup[];
  racks: RackAuditGroup[];
  allMissingPorts: PortStatusItem[];
  onSelectPort?: (port: PortStatusItem) => void;
}

export const MissingPortsTable: React.FC<MissingPortsTableProps> = ({
  switches,
  racks,
  allMissingPorts,
  onSelectPort,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRack, setSelectedRack] = useState<string>('all');
  const [selectedSwitch, setSelectedSwitch] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSwitchId, setExpandedSwitchId] = useState<string | null>(null);

  // Filter switches that have missing ports
  const filteredSwitches = useMemo(() => {
    return switches.filter(sw => {
      if (selectedRack !== 'all' && sw.rackId !== selectedRack) return false;
      if (selectedSwitch !== 'all' && sw.switchId !== selectedSwitch) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = sw.deviceName.toLowerCase().includes(query);
        const matchesRack = sw.rackId.toLowerCase().includes(query);
        const matchesSwitch = sw.switchId.toLowerCase().includes(query);
        const matchesRanges = sw.missingBaseRangesText.toLowerCase().includes(query);
        const matchesIndividualPort = sw.ports.some(
          p => p.isMissing && p.portId.toLowerCase().includes(query)
        );
        return matchesName || matchesRack || matchesSwitch || matchesRanges || matchesIndividualPort;
      }
      return true;
    });
  }, [switches, selectedRack, selectedSwitch, searchTerm]);

  // Export CSV of missing ports
  const handleExportCSV = () => {
    const headers = [
      'Rack (FNR)',
      'Switch (S-Number)',
      'Switch Unit',
      'Device Name',
      'Port Name',
      'Port Number',
      'Speed',
      'Status',
    ];

    const rows: string[][] = [];
    allMissingPorts.forEach(port => {
      rows.push([
        port.rackId,
        port.switchId,
        port.switchUnit.toString(),
        port.deviceName,
        port.portId,
        port.portNumber.toString(),
        port.speedCategory,
        'MISSING FROM AUDIT',
      ]);
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `network-audit-missing-ports-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopySwitchMissing = (sw: SwitchAuditGroup) => {
    const text = sw.ports
      .filter(p => p.isMissing)
      .map(p => p.portId)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedId(sw.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      id="missing-ports-audit-table"
      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl"
    >
      {/* Table Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
              <TableIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Audit Discrepancy & Missing Ports Registry
              </h3>
              <p className="text-xs text-slate-400">
                Detailed missing port numbers categorized by Rack (FNR) and Switch Unit (S#)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="export-missing-csv-btn"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export Missing Ports (CSV)</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="table-search-input"
            type="text"
            placeholder="Search port number, rack FNR, or switch..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Rack (FNR) Filter */}
        <div className="relative">
          <select
            id="rack-fnr-select"
            value={selectedRack}
            onChange={e => setSelectedRack(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="all">All Racks (FNR Numbers)</option>
            {racks.map(r => (
              <option key={r.rackId} value={r.rackId}>
                Rack {r.rackId} (FNR #{r.rackNumber})
              </option>
            ))}
          </select>
        </div>

        {/* Switch Unit (S#) Filter */}
        <div className="relative">
          <select
            id="switch-unit-select"
            value={selectedSwitch}
            onChange={e => setSelectedSwitch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="all">All Switches (S-Numbers)</option>
            {switches.map(sw => (
              <option key={sw.id} value={sw.switchId}>
                {sw.rackId} • Switch {sw.switchId}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4">Rack (FNR)</th>
              <th className="py-3 px-4">Switch (S# / Unit)</th>
              <th className="py-3 px-4">Device Hostname</th>
              <th className="py-3 px-4">Status & Count</th>
              <th className="py-3 px-4">Missing Port Numbers (Compact)</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 bg-slate-900/50">
            {filteredSwitches.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No matching switch audit records found.
                </td>
              </tr>
            ) : (
              filteredSwitches.map(sw => {
                const isExpanded = expandedSwitchId === sw.id;
                const missingList = sw.ports.filter(p => p.isMissing);

                return (
                  <React.Fragment key={sw.id}>
                    <tr className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 font-mono">
                          {sw.rackId}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          FNR #{sw.rackNumber}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 font-mono">
                            {sw.switchId}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Unit {sw.switchUnit}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <code className="text-slate-300 font-mono text-[11px] block truncate max-w-xs" title={sw.deviceName}>
                          {sw.deviceName}
                        </code>
                        <span className="text-[10px] text-slate-400">
                          {sw.baseCapacity} Base Ports + {sw.totalUplinkPorts} Uplinks
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {sw.missingCount > 0 ? (
                          <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{sw.missingCount} Missing</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({sw.configuredCount} found)
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>100% Complete</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {sw.missingCount > 0 ? (
                          <div className="font-mono text-amber-300 bg-amber-950/40 px-2.5 py-1 rounded border border-amber-800/40 text-[11px] inline-block max-w-md break-words">
                            {sw.missingBaseRangesText}
                            {sw.modules.some(m => m.missingPorts.length > 0) && (
                              <span className="text-slate-400 block text-[10px] mt-0.5">
                                Uplinks: {sw.modules.map(m => `${m.interfaceType}: ${m.missingRangesText}`).join('; ')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No missing ports</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {sw.missingCount > 0 && (
                            <button
                              id={`copy-missing-row-${sw.id}`}
                              onClick={() => handleCopySwitchMissing(sw)}
                              title="Copy all missing port names"
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
                            >
                              {copiedId === sw.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          <button
                            id={`toggle-expand-row-${sw.id}`}
                            onClick={() => setExpandedSwitchId(isExpanded ? null : sw.id)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 text-xs transition-colors"
                          >
                            {isExpanded ? 'Hide List' : 'View Ports'}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Breakdown of Individual Missing Ports */}
                    {isExpanded && (
                      <tr className="bg-slate-950/90 border-b border-slate-800">
                        <td colSpan={6} className="p-4">
                          <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                            <span>
                              Individual Missing Port Identifiers for Rack {sw.rackId} • Switch {sw.switchId}:
                            </span>
                            <span className="text-slate-400 font-normal">
                              Total {missingList.length} items
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                            {missingList.map(p => (
                              <button
                                key={p.canonicalId}
                                onClick={() => onSelectPort && onSelectPort(p)}
                                className="p-2 bg-slate-900 hover:bg-amber-950/50 border border-amber-500/30 hover:border-amber-400 rounded-lg text-left transition-colors cursor-pointer group"
                              >
                                <div className="text-[10px] text-amber-400 font-mono font-bold truncate">
                                  {p.portId}
                                </div>
                                <div className="text-[9px] text-slate-400 flex items-center justify-between mt-1">
                                  <span>Port #{p.portNumber}</span>
                                  <span className="text-amber-300 font-semibold group-hover:underline">
                                    Map
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
