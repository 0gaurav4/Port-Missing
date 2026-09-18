import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { GenericParsedTable, ModuleMissingAudit, PortAuditDetail, RackAuditSummary } from '../types';
import {
  parseGenericTableData,
  analyzeModulesMissingPorts,
  SwitchCapacityMode,
} from '../utils/auditParser';
import { SAMPLE_PORT_SECURITY_TEXT } from '../data/samplePortSecurityData';
import {
  Check,
  Copy,
  Download,
  Search,
  Upload,
  ChevronDown,
  ChevronRight,
  Terminal,
  AlertTriangle,
  FileSpreadsheet,
  Server,
  Activity,
  Filter,
  CheckCircle2,
  XCircle,
  Layers,
  ArrowUpDown,
} from 'lucide-react';

export const StreamlitSwitchportView: React.FC = () => {
  // Input raw text, initialized with sample data matching user's spreadsheet
  const [rawText, setRawText] = useState<string>(SAMPLE_PORT_SECURITY_TEXT);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [capacityMode, setCapacityMode] = useState<SwitchCapacityMode>('auto');

  // Rack & Port Status Filtering
  const [selectedRackId, setSelectedRackId] = useState<string>('all');
  const [portStatusFilter, setPortStatusFilter] = useState<'all' | 'missing' | 'down' | 'up'>('all');
  const [viewTab, setViewTab] = useState<'faceplates' | 'missing_down_table'>('faceplates');

  // Table search & pagination state for Data Preview
  const [tableSearch, setTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Missing & Down inspection table search
  const [auditTableSearch, setAuditTableSearch] = useState('');

  // Accordion open states for modules
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  // Hovered port state for detailed tooltip
  const [hoveredPort, setHoveredPort] = useState<PortAuditDetail | null>(null);

  // Copied toast state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse raw text into generic table
  const parsedTable: GenericParsedTable = useMemo(() => {
    return parseGenericTableData(rawText);
  }, [rawText]);

  // Analyze missing, up, and down ports across racks and modules
  const analysis = useMemo(() => {
    return analyzeModulesMissingPorts(parsedTable, capacityMode);
  }, [parsedTable, capacityMode]);

  // Set initial open module if none open
  React.useEffect(() => {
    if (analysis.modules.length > 0 && Object.keys(openModules).length === 0) {
      const firstId = analysis.modules[0].moduleId;
      setOpenModules({ [firstId]: true });
    }
  }, [analysis.modules]);

  // Filtered modules by selected Rack
  const filteredModules = useMemo(() => {
    if (selectedRackId === 'all') return analysis.modules;
    return analysis.modules.filter(m => (m.rackId || 'General Rack') === selectedRackId);
  }, [analysis.modules, selectedRackId]);

  // Selected rack object if not 'all'
  const currentRackSummary = useMemo(() => {
    if (selectedRackId === 'all') return null;
    return analysis.racks.find(r => r.rackId === selectedRackId) || null;
  }, [analysis.racks, selectedRackId]);

  // Filtered rows for the Streamlit dataframe table
  const filteredRows = useMemo(() => {
    if (!tableSearch.trim()) return parsedTable.rows;
    const q = tableSearch.toLowerCase();
    return parsedTable.rows.filter(row =>
      Object.values(row).some(val => val.toLowerCase().includes(q))
    );
  }, [parsedTable.rows, tableSearch]);

  // Pagination calculation
  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const displayedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Reset page when search or data changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [tableSearch, rawText]);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Toggle module open/close
  const toggleModule = (id: string) => {
    setOpenModules(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // File upload handler supporting Excel (.xlsx, .xls), CSV, TSV, TXT, LOG
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    const fileName = file.name;
    const isExcel = /\.(xlsx|xls)$/i.test(fileName);

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = event => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const workbook = XLSX.read(buffer, { type: 'array' });
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            setUploadError('The Excel file contains no worksheets.');
            return;
          }
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const csvContent = XLSX.utils.sheet_to_csv(firstSheet, { blankrows: false });
          if (!csvContent.trim()) {
            setUploadError('The first sheet in this Excel file appears to be empty.');
            return;
          }
          setRawText(csvContent);
          setUploadedFileName(fileName);
          setSelectedRackId('all');
        } catch (err) {
          console.error('Error reading Excel file:', err);
          setUploadError('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
        }
      };
      reader.onerror = () => {
        setUploadError('Failed to read file.');
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = event => {
        const content = event.target?.result as string;
        if (content) {
          setRawText(content);
          setUploadedFileName(fileName);
          setSelectedRackId('all');
        }
      };
      reader.onerror = () => {
        setUploadError('Failed to read file.');
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  // Export full audit report as CSV (Rack, Switch, Device, Port, Status, Admin, Oper, Desc, IP, MAC)
  const handleExportCSV = () => {
    const headers = [
      'Rack (FNR)',
      'Switch (S-Number)',
      'Device Name',
      'Port Identifier',
      'Port Number',
      'Audit Status',
      'Operational Status',
      'Admin Status',
      'Description',
      'IP Address',
      'MAC Address',
    ];

    const rows: string[][] = [];
    analysis.modules.forEach(mod => {
      mod.allPortStatuses.forEach(p => {
        rows.push([
          mod.rackId || 'N/A',
          mod.switchId || 'N/A',
          mod.deviceName || 'N/A',
          p.portName,
          p.portNumber.toString(),
          p.status.toUpperCase(),
          p.operStatus || (p.status === 'missing' ? 'N/A' : p.status),
          p.adminStatus || 'N/A',
          p.description || '',
          p.ipAddress || '',
          p.macAddress || '',
        ]);
      });
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `network-audit-up-down-racks-missing-ports.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Comprehensive list of all Missing and Down ports for the audit table
  const auditTableItems = useMemo(() => {
    const items: {
      rackId: string;
      switchId: string;
      deviceName?: string;
      modulePrefix: string;
      portDetail: PortAuditDetail;
    }[] = [];

    analysis.modules.forEach(mod => {
      if (selectedRackId !== 'all' && (mod.rackId || 'General Rack') !== selectedRackId) {
        return;
      }

      mod.allPortStatuses.forEach(p => {
        if (portStatusFilter === 'missing' && !p.isMissing) return;
        if (portStatusFilter === 'down' && p.status !== 'down') return;
        if (portStatusFilter === 'up' && p.status !== 'up') return;

        items.push({
          rackId: mod.rackId || 'General Rack',
          switchId: mod.switchId || `Unit ${mod.switchUnit}`,
          deviceName: mod.deviceName,
          modulePrefix: mod.modulePrefix,
          portDetail: p,
        });
      });
    });

    if (!auditTableSearch.trim()) return items;
    const q = auditTableSearch.toLowerCase();
    return items.filter(it => {
      return (
        it.rackId.toLowerCase().includes(q) ||
        it.switchId.toLowerCase().includes(q) ||
        (it.deviceName && it.deviceName.toLowerCase().includes(q)) ||
        it.portDetail.portName.toLowerCase().includes(q) ||
        it.portDetail.status.toLowerCase().includes(q) ||
        (it.portDetail.description && it.portDetail.description.toLowerCase().includes(q)) ||
        (it.portDetail.ipAddress && it.portDetail.ipAddress.toLowerCase().includes(q)) ||
        (it.portDetail.macAddress && it.portDetail.macAddress.toLowerCase().includes(q))
      );
    });
  }, [analysis.modules, selectedRackId, portStatusFilter, auditTableSearch]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 text-[#f0f2f6]">
      {/* Streamlit-Style Title Bar */}
      <div className="border-b border-[#262730] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="text-[#ff4b4b]">●</span> Switchport Missing Port & Rack Audit
            </h1>
            <p className="text-xs text-[#a3a8b8] mt-1">
              Audit missing ports and operational up/down port states across physical racks (FNR) & switch units
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Top Upload Button - Accepts Excel (.xlsx, .xls) and CSV/TXT */}
            <input
              ref={fileInputRef}
              id="top-file-upload-input"
              type="file"
              accept=".xlsx,.xls,.csv,.tsv,.txt,.log,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              id="top-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#ff4b4b] hover:bg-[#e03a3a] text-white rounded-md text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Upload Excel spreadsheet (.xlsx, .xls) or text/csv output"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload File (.xlsx / .csv)</span>
            </button>

            {uploadedFileName && (
              <div className="flex items-center gap-1.5 bg-[#1e2129] border border-[#363945] px-2.5 py-1 rounded text-xs text-sky-400 font-mono">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate max-w-[140px]" title={uploadedFileName}>
                  {uploadedFileName}
                </span>
                <button
                  onClick={() => {
                    setUploadedFileName(null);
                    setRawText('');
                  }}
                  className="text-[#808495] hover:text-white ml-0.5 text-xs font-bold leading-none cursor-pointer"
                  title="Remove uploaded file"
                >
                  ×
                </button>
              </div>
            )}

            {/* Switch Capacity Mode */}
            <div className="flex items-center bg-[#1e2129] border border-[#363945] rounded-md p-0.5 text-xs">
              <span className="px-2 text-[11px] text-[#808495] font-medium hidden sm:inline">
                Profile:
              </span>
              <button
                onClick={() => setCapacityMode('auto')}
                className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                  capacityMode === 'auto'
                    ? 'bg-[#ff4b4b] text-white font-semibold shadow'
                    : 'text-[#a3a8b8] hover:text-white'
                }`}
                title="Automatically determine 24 vs 48 port capacity"
              >
                Auto
              </button>
              <button
                onClick={() => setCapacityMode(48)}
                className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                  capacityMode === 48
                    ? 'bg-[#ff4b4b] text-white font-semibold shadow'
                    : 'text-[#a3a8b8] hover:text-white'
                }`}
              >
                48P
              </button>
              <button
                onClick={() => setCapacityMode(24)}
                className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                  capacityMode === 24
                    ? 'bg-[#ff4b4b] text-white font-semibold shadow'
                    : 'text-[#a3a8b8] hover:text-white'
                }`}
              >
                24P
              </button>
            </div>

            {/* Export CSV button */}
            {analysis.totalExpectedPorts > 0 && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#262730] hover:bg-[#363945] border border-[#464b5d] text-white rounded-md text-xs font-medium transition-colors cursor-pointer"
                title="Export complete audit report with Up, Down, and Missing ports per rack"
              >
                <Download className="w-3.5 h-3.5 text-[#21c354]" />
                <span>Export CSV</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upload Error Banner if any */}
      {uploadError && (
        <div className="bg-[#3a1d1d] border border-red-500/40 text-red-200 px-3 py-2 rounded text-xs flex items-center justify-between">
          <span>{uploadError}</span>
          <button
            onClick={() => setUploadError(null)}
            className="text-red-400 hover:text-white ml-2 text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Input Section: Streamlit st.text_area */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[#a3a8b8] uppercase tracking-wider flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-[#ff4b4b]" />
            <span>Paste switchport CLI output, spreadsheet, or audit table</span>
          </label>
          <div className="flex items-center gap-3 text-[11px] text-[#808495]">
            <span>{rawText.split(/\r?\n/).filter(l => l.trim()).length} lines</span>
            {rawText && (
              <button
                onClick={() => {
                  setRawText('');
                  setUploadedFileName(null);
                }}
                className="text-[#808495] hover:text-[#ff4b4b] transition-colors cursor-pointer"
                title="Clear input"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Text Area */}
        <div className="relative">
          <textarea
            id="switchport-raw-textarea"
            value={rawText}
            onChange={e => {
              setRawText(e.target.value);
              if (uploadedFileName) setUploadedFileName(null);
            }}
            placeholder="Paste raw output here or click 'Upload File' at the top...&#10;Sl.No  Device Name  IP Address  Port Name  Description  Admin Status  Operation..."
            rows={5}
            className="w-full bg-[#1e2129] border border-[#363945] focus:border-[#ff4b4b] focus:ring-1 focus:ring-[#ff4b4b] rounded-md p-3 font-mono text-xs text-[#f0f2f6] placeholder-[#555a6d] outline-none transition-colors resize-y shadow-inner leading-relaxed"
          />
        </div>
      </div>

      {/* Streamlit Green Parse Status Box */}
      {parsedTable.totalRows > 0 && (
        <div
          id="parsed-status-badge"
          className="bg-[#0f2d1d] border border-[#21c354]/40 text-[#21c354] px-4 py-2.5 rounded-md text-sm font-medium flex items-center justify-between flex-wrap gap-2"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#21c354] animate-pulse"></span>
            <span>
              Parsed {parsedTable.totalRows} rows across {analysis.racks.length} rack{analysis.racks.length > 1 ? 's' : ''} ({parsedTable.totalColumns} columns)
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-[#21c354]/90">
            <span>Port: {parsedTable.portColumnName}</span>
            {parsedTable.operStatusColumnName && (
              <span className="hidden sm:inline">Status: {parsedTable.operStatusColumnName}</span>
            )}
          </div>
        </div>
      )}

      {/* Streamlit DataFrame Interactive Table */}
      {parsedTable.totalRows > 0 && (
        <div className="bg-[#1e2129] border border-[#262730] rounded-md overflow-hidden shadow-md">
          {/* Table Header Controls */}
          <div className="px-3.5 py-2.5 border-b border-[#262730] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#808495]">Data Preview</span>
              <span className="text-[11px] px-1.5 py-0.2 bg-[#262730] text-[#a3a8b8] rounded font-mono">
                {totalRows} records
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-[#808495]" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                  placeholder="Filter rows..."
                  className="bg-[#262730] border border-[#363945] rounded pl-7 pr-2 py-1 text-xs text-white placeholder-[#808495] outline-none w-36 sm:w-48 focus:border-[#ff4b4b]"
                />
              </div>

              {/* Rows per page selector */}
              <select
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
                className="bg-[#262730] border border-[#363945] text-xs text-[#a3a8b8] rounded px-2 py-1 outline-none cursor-pointer"
              >
                <option value={10}>10 rows</option>
                <option value={25}>25 rows</option>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
              </select>
            </div>
          </div>

          {/* Table Dataframe */}
          <div className="overflow-x-auto max-h-[300px] scrollbar-thin scrollbar-thumb-[#363945]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#262730] bg-[#1a1c24] text-[#808495] sticky top-0 z-10 font-mono">
                  <th className="py-2 px-3.5 w-12 text-center text-[#555a6d] font-normal border-r border-[#262730]">
                    #
                  </th>
                  {parsedTable.headers.map((col, idx) => (
                    <th
                      key={idx}
                      className={`py-2 px-3.5 font-semibold text-white ${
                        col === parsedTable.portColumnName
                          ? 'text-[#ff4b4b] bg-[#ff4b4b]/5'
                          : col === parsedTable.operStatusColumnName
                          ? 'text-amber-300'
                          : ''
                      }`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262730] font-mono text-[#dcdfe7]">
                {displayedRows.map((row, rIdx) => {
                  const absoluteIndex = (currentPage - 1) * pageSize + rIdx;
                  return (
                    <tr
                      key={rIdx}
                      className="hover:bg-[#262730]/70 transition-colors"
                    >
                      <td className="py-1.5 px-3 text-center text-[#555a6d] text-[11px] border-r border-[#262730] bg-[#1a1c24]/50 select-none">
                        {absoluteIndex}
                      </td>
                      {parsedTable.headers.map((col, cIdx) => {
                        const val = row[col] || '';
                        const isPort = col === parsedTable.portColumnName;
                        const isOper = col === parsedTable.operStatusColumnName;
                        const isDown = isOper && val.toLowerCase() === 'down';
                        const isUp = isOper && val.toLowerCase() === 'up';

                        return (
                          <td
                            key={cIdx}
                            className={`py-1.5 px-3.5 whitespace-nowrap ${
                              isPort ? 'font-semibold text-white' : ''
                            } ${isDown ? 'text-amber-400 font-semibold' : ''} ${
                              isUp ? 'text-emerald-400' : ''
                            }`}
                          >
                            {isDown ? (
                              <span className="inline-flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded text-amber-300 border border-amber-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                {val}
                              </span>
                            ) : isUp ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                {val}
                              </span>
                            ) : (
                              val
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-3.5 py-2 bg-[#1a1c24] border-t border-[#262730] flex items-center justify-between text-xs text-[#808495]">
            <span>
              Showing {Math.min(totalRows, (currentPage - 1) * pageSize + 1)} -{' '}
              {Math.min(totalRows, currentPage * pageSize)} of {totalRows}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-2 py-0.5 rounded bg-[#262730] hover:bg-[#363945] disabled:opacity-40 disabled:hover:bg-[#262730] text-[#a3a8b8] transition-colors cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 text-white">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-2 py-0.5 rounded bg-[#262730] hover:bg-[#363945] disabled:opacity-40 disabled:hover:bg-[#262730] text-[#a3a8b8] transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RACK AUDIT & MISSING / UP / DOWN PORT ANALYSIS SECTION */}
      {/* ========================================================================= */}
      <div className="pt-2 space-y-5">
        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#262730] pb-3">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Server className="w-5 h-5 text-[#ff4b4b]" />
              <span>Rack Audit: Missing Ports & Up / Down Status</span>
            </h2>
            <p className="text-xs text-[#a3a8b8] mt-0.5">
              Identifies missing port sequence gaps alongside active (UP) and inactive (DOWN) ports per rack
            </p>
          </div>

          {/* View Tab Selector: Faceplates vs Audit Table */}
          <div className="flex items-center bg-[#1e2129] border border-[#363945] rounded-md p-0.5 text-xs">
            <button
              onClick={() => setViewTab('faceplates')}
              className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                viewTab === 'faceplates'
                  ? 'bg-[#262730] text-white font-semibold shadow'
                  : 'text-[#808495] hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Rack Modules & Faceplates</span>
            </button>
            <button
              onClick={() => setViewTab('missing_down_table')}
              className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                viewTab === 'missing_down_table'
                  ? 'bg-[#262730] text-white font-semibold shadow'
                  : 'text-[#808495] hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Missing & Down Table</span>
            </button>
          </div>
        </div>

        {/* Global Metric Cards (Missing, Down, Up, Total Expected) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Missing Ports Card */}
          <div className="bg-[#1e2129] border border-red-500/30 rounded-lg p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[#808495]">
              <span className="font-semibold text-red-400 uppercase tracking-wider text-[10px]">
                Missing Ports
              </span>
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-2xl font-mono font-bold text-red-400 mt-1">
              {analysis.totalMissingPorts}
            </div>
            <div className="text-[11px] text-[#808495] mt-0.5">
              Unlogged in {analysis.modulesWithMissingCount} module(s)
            </div>
          </div>

          {/* Operationally Down Ports Card */}
          <div className="bg-[#1e2129] border border-amber-500/30 rounded-lg p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[#808495]">
              <span className="font-semibold text-amber-400 uppercase tracking-wider text-[10px]">
                Down Ports (Inactive)
              </span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-mono font-bold text-amber-400 mt-1">
              {analysis.totalDownPorts}
            </div>
            <div className="text-[11px] text-[#808495] mt-0.5">
              Configured with status down
            </div>
          </div>

          {/* Operationally Up Ports Card */}
          <div className="bg-[#1e2129] border border-emerald-500/30 rounded-lg p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[#808495]">
              <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[10px]">
                Up Ports (Active)
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
              {analysis.totalUpPorts}
            </div>
            <div className="text-[11px] text-[#808495] mt-0.5">
              Connected & active links
            </div>
          </div>

          {/* Total Capacity Card */}
          <div className="bg-[#1e2129] border border-[#363945] rounded-lg p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-[#808495]">
              <span className="font-semibold text-[#a3a8b8] uppercase tracking-wider text-[10px]">
                Total Sockets
              </span>
              <Server className="w-4 h-4 text-[#808495]" />
            </div>
            <div className="text-2xl font-mono font-bold text-white mt-1">
              {analysis.totalExpectedPorts}
            </div>
            <div className="text-[11px] text-[#808495] mt-0.5">
              Across {analysis.racks.length} rack{analysis.racks.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RACK SELECTION TABS & RACK OVERVIEW CARDS */}
        {/* ========================================================================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-[#a3a8b8] uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#ff4b4b]" />
              Filter by Rack:
            </span>
            <span className="text-[11px] font-normal text-[#808495]">
              Showing {selectedRackId === 'all' ? 'All Racks' : selectedRackId}
            </span>
          </div>

          {/* Rack Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedRackId('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedRackId === 'all'
                  ? 'bg-[#ff4b4b] text-white shadow font-semibold'
                  : 'bg-[#1e2129] hover:bg-[#262730] text-[#a3a8b8] border border-[#262730]'
              }`}
            >
              <span>All Racks ({analysis.racks.length})</span>
            </button>

            {analysis.racks.map(rack => (
              <button
                key={rack.rackId}
                onClick={() => setSelectedRackId(rack.rackId)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 cursor-pointer border ${
                  selectedRackId === rack.rackId
                    ? 'bg-[#ff4b4b] text-white border-[#ff4b4b] font-semibold shadow'
                    : 'bg-[#1e2129] hover:bg-[#262730] text-[#a3a8b8] border-[#262730]'
                }`}
              >
                <Server className="w-3 h-3" />
                <span>Rack {rack.rackId}</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#14171f]/60 text-red-300">
                  {rack.totalMissingPorts} missing
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#14171f]/60 text-amber-300">
                  {rack.totalDownPorts} down
                </span>
              </button>
            ))}
          </div>

          {/* Rack Summary Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {analysis.racks
              .filter(r => selectedRackId === 'all' || r.rackId === selectedRackId)
              .map(rack => {
                const upPercent = Math.round((rack.totalUpPorts / (rack.totalExpectedPorts || 1)) * 100);
                const downPercent = Math.round((rack.totalDownPorts / (rack.totalExpectedPorts || 1)) * 100);
                const missingPercent = Math.max(0, 100 - upPercent - downPercent);

                return (
                  <div
                    key={rack.rackId}
                    className={`bg-[#1e2129] rounded-lg border p-4 transition-all shadow-sm ${
                      selectedRackId === rack.rackId
                        ? 'border-[#ff4b4b] ring-1 ring-[#ff4b4b]/30'
                        : 'border-[#262730] hover:border-[#363945]'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[#262730]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold font-mono text-xs">
                          {rack.rackNumber}
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm font-mono">
                            Rack {rack.rackId}
                          </div>
                          <div className="text-[10px] text-[#808495] font-mono truncate max-w-[200px]" title={rack.devices.join(', ')}>
                            {rack.devices.join(', ') || 'Switch Module'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedRackId(rack.rackId)}
                          className={`text-[11px] px-2 py-1 rounded transition-colors cursor-pointer ${
                            selectedRackId === rack.rackId
                              ? 'bg-[#ff4b4b]/20 text-[#ff4b4b] font-semibold'
                              : 'bg-[#262730] text-[#a3a8b8] hover:text-white'
                          }`}
                        >
                          {selectedRackId === rack.rackId ? 'Selected' : 'Focus'}
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar (Up % / Down % / Missing %) */}
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-emerald-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          UP: {rack.totalUpPorts}
                        </span>
                        <span className="text-amber-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                          DOWN: {rack.totalDownPorts}
                        </span>
                        <span className="text-red-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-400"></span>
                          MISSING: {rack.totalMissingPorts}
                        </span>
                      </div>

                      <div className="w-full h-2.5 bg-[#14171f] rounded-full overflow-hidden flex border border-[#262730]">
                        <div
                          style={{ width: `${upPercent}%` }}
                          className="bg-emerald-500 h-full transition-all"
                          title={`Up: ${rack.totalUpPorts} ports (${upPercent}%)`}
                        />
                        <div
                          style={{ width: `${downPercent}%` }}
                          className="bg-amber-400 h-full transition-all"
                          title={`Down: ${rack.totalDownPorts} ports (${downPercent}%)`}
                        />
                        <div
                          style={{ width: `${missingPercent}%` }}
                          className="bg-red-500/80 h-full transition-all"
                          title={`Missing: ${rack.totalMissingPorts} ports (${missingPercent}%)`}
                        />
                      </div>
                    </div>

                    {/* Missing & Down Port Badges */}
                    <div className="mt-3 pt-2.5 border-t border-[#262730] text-xs space-y-1.5">
                      <div className="flex items-start gap-1.5">
                        <span className="text-[11px] font-semibold text-red-400 shrink-0">
                          Missing:
                        </span>
                        <span className="font-mono text-[11px] text-red-300 break-words line-clamp-2">
                          {rack.missingRangesText || 'None'}
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-[11px] font-semibold text-amber-400 shrink-0">
                          Down:
                        </span>
                        <span className="font-mono text-[11px] text-amber-200/90 break-words line-clamp-2">
                          {rack.downPortsText || 'None'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Port Status Filter Buttons (All / Missing / Down / Up) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#262730]">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#808495] font-medium mr-1">Port Status Filter:</span>
            <button
              onClick={() => setPortStatusFilter('all')}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                portStatusFilter === 'all'
                  ? 'bg-[#262730] text-white font-semibold border border-[#363945]'
                  : 'text-[#808495] hover:text-white'
              }`}
            >
              All Ports
            </button>
            <button
              onClick={() => setPortStatusFilter('missing')}
              className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1 cursor-pointer ${
                portStatusFilter === 'missing'
                  ? 'bg-red-500/20 text-red-300 font-semibold border border-red-500/40'
                  : 'text-[#808495] hover:text-red-400'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Missing Only</span>
            </button>
            <button
              onClick={() => setPortStatusFilter('down')}
              className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1 cursor-pointer ${
                portStatusFilter === 'down'
                  ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40'
                  : 'text-[#808495] hover:text-amber-400'
              }`}
            >
              <Activity className="w-3 h-3" />
              <span>Down Only</span>
            </button>
            <button
              onClick={() => setPortStatusFilter('up')}
              className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1 cursor-pointer ${
                portStatusFilter === 'up'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40'
                  : 'text-[#808495] hover:text-emerald-400'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Up Only</span>
            </button>
          </div>

          <div className="text-xs text-[#808495] font-mono">
            {filteredModules.length} module(s) in view
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: MODULES & PHYSICAL RJ45 FACEPLATES */}
        {/* ========================================================================= */}
        {viewTab === 'faceplates' && (
          <div className="space-y-3">
            {filteredModules.map(mod => {
              const isOpen = !!openModules[mod.moduleId];
              const hasMissing = mod.missingPortNumbers.length > 0;

              return (
                <div
                  key={mod.moduleId}
                  className="bg-[#1e2129] border border-[#262730] rounded-md overflow-hidden transition-all shadow-sm"
                >
                  {/* Accordion Header */}
                  <button
                    id={`module-accordion-${mod.moduleId}`}
                    onClick={() => toggleModule(mod.moduleId)}
                    className="w-full px-4 py-3 bg-[#262730] hover:bg-[#2c2e3a] flex items-center justify-between text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 font-medium text-sm flex-wrap">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-[#ff4b4b] shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#808495] shrink-0" />
                      )}
                      <span className="text-white font-mono font-bold">
                        {mod.modulePrefix}
                      </span>
                      <span className="text-[#808495]">—</span>

                      {/* Tri-state badges */}
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30 font-mono">
                        {mod.missingPortNumbers.length} Missing
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                        {mod.downPortNumbers.length} Down
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                        {mod.upPortNumbers.length} Up
                      </span>

                      {/* Show Rack (FNR) & Switch (S#) badge */}
                      {mod.rackId && (
                        <span className="ml-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#14171f] text-amber-400 border border-amber-500/20 font-mono hidden sm:inline">
                          Rack {mod.rackId} • Switch {mod.switchId}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[#808495] font-mono shrink-0">
                      <span>
                        {mod.configuredPortNumbers.length} / {mod.capacity} ports
                      </span>
                    </div>
                  </button>

                  {/* Accordion Content */}
                  {isOpen && (
                    <div className="p-4 space-y-4 border-t border-[#262730] bg-[#1a1c24]/50">
                      {/* Module Metadata Details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div className="bg-[#1e2129] p-2.5 rounded border border-[#262730]">
                          <span className="text-[#808495] block text-[10px] uppercase font-semibold">
                            Rack (FNR) & Switch
                          </span>
                          <span className="font-mono font-bold text-amber-400 mt-0.5 block truncate">
                            {mod.rackId || 'General Rack'} / {mod.switchId || 'Unit ' + mod.switchUnit}
                          </span>
                        </div>

                        <div className="bg-[#1e2129] p-2.5 rounded border border-[#262730]">
                          <span className="text-[#808495] block text-[10px] uppercase font-semibold">
                            Missing Sockets
                          </span>
                          <span className="font-mono font-bold text-red-400 mt-0.5 block">
                            {mod.missingPortNumbers.length} unlogged ports
                          </span>
                        </div>

                        <div className="bg-[#1e2129] p-2.5 rounded border border-[#262730]">
                          <span className="text-[#808495] block text-[10px] uppercase font-semibold">
                            Down Sockets (Inactive)
                          </span>
                          <span className="font-mono font-bold text-amber-400 mt-0.5 block">
                            {mod.downPortNumbers.length} ports down
                          </span>
                        </div>

                        <div className="bg-[#1e2129] p-2.5 rounded border border-[#262730]">
                          <span className="text-[#808495] block text-[10px] uppercase font-semibold">
                            Up Sockets (Active)
                          </span>
                          <span className="font-mono font-bold text-emerald-400 mt-0.5 block">
                            {mod.upPortNumbers.length} ports active
                          </span>
                        </div>
                      </div>

                      {/* Missing Port Ranges & Down Ports Copy Boxes */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Missing Ranges Box */}
                        <div className="bg-[#262730] border border-red-500/20 rounded-md p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                              Missing Port Ranges ({mod.missingPortNumbers.length}):
                            </span>
                            {mod.missingPortNumbers.length > 0 && (
                              <button
                                onClick={() =>
                                  handleCopy(
                                    mod.missingPortStrings.join(', '),
                                    `ports-missing-${mod.moduleId}`
                                  )
                                }
                                className="flex items-center gap-1 px-2 py-0.5 bg-[#1e2129] hover:bg-[#363945] text-xs text-[#dcdfe7] rounded transition-colors cursor-pointer"
                              >
                                {copiedKey === `ports-missing-${mod.moduleId}` ? (
                                  <>
                                    <Check className="w-3 h-3 text-[#21c354]" />
                                    <span className="text-[#21c354]">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy Missing</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                          <div className="font-mono text-xs text-white bg-[#1e2129] p-2 rounded border border-[#363945] break-words">
                            {mod.missingRangesText || 'No missing ports detected.'}
                          </div>
                        </div>

                        {/* Down Ports Box */}
                        <div className="bg-[#262730] border border-amber-500/20 rounded-md p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5 text-amber-400" />
                              Down Ports ({mod.downPortNumbers.length}):
                            </span>
                            {mod.downPortNumbers.length > 0 && (
                              <button
                                onClick={() =>
                                  handleCopy(
                                    mod.downPortStrings.join(', '),
                                    `ports-down-${mod.moduleId}`
                                  )
                                }
                                className="flex items-center gap-1 px-2 py-0.5 bg-[#1e2129] hover:bg-[#363945] text-xs text-[#dcdfe7] rounded transition-colors cursor-pointer"
                              >
                                {copiedKey === `ports-down-${mod.moduleId}` ? (
                                  <>
                                    <Check className="w-3 h-3 text-[#21c354]" />
                                    <span className="text-[#21c354]">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy Down</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                          <div className="font-mono text-xs text-white bg-[#1e2129] p-2 rounded border border-[#363945] break-words">
                            {mod.downPortStrings.join(', ') || 'No down ports detected.'}
                          </div>
                        </div>
                      </div>

                      {/* Cisco CLI Interface Range Command */}
                      {mod.ciscoRangeCommand && (
                        <div className="bg-[#1e2129] border border-[#363945] rounded-md p-3">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-xs font-semibold text-[#a3a8b8] flex items-center gap-1">
                              <Terminal className="w-3.5 h-3.5 text-sky-400" />
                              Cisco CLI Interface Range Configuration:
                            </span>
                            <button
                              onClick={() =>
                                handleCopy(mod.ciscoRangeCommand, `cli-${mod.moduleId}`)
                              }
                              className="flex items-center gap-1 px-2 py-0.5 bg-[#262730] hover:bg-[#363945] text-xs text-sky-300 rounded transition-colors cursor-pointer"
                            >
                              {copiedKey === `cli-${mod.moduleId}` ? (
                                <>
                                  <Check className="w-3 h-3 text-[#21c354]" />
                                  <span className="text-[#21c354]">Copied Command!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy CLI</span>
                                </>
                              )}
                            </button>
                          </div>
                          <code className="font-mono text-xs text-emerald-400 block bg-[#14171f] p-2 rounded border border-[#262730] overflow-x-auto whitespace-pre">
                            {mod.ciscoRangeCommand}
                          </code>
                        </div>
                      )}

                      {/* ========================================================================= */}
                      {/* PHYSICAL RJ45 SWITCH FACEPLATE (UP, DOWN, MISSING) */}
                      {/* ========================================================================= */}
                      <div className="space-y-2 pt-1">
                        <div className="flex flex-wrap items-center justify-between text-xs text-[#808495] gap-2">
                          <span className="font-medium text-white">
                            Switch Port Faceplate (1..{mod.capacity}) — Rack {mod.rackId || 'FNR'}:
                          </span>
                          <div className="flex items-center gap-3 text-[11px] flex-wrap">
                            <span className="flex items-center gap-1 text-emerald-400">
                              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30 border border-emerald-400"></span>
                              Active UP ({mod.upPortNumbers.length})
                            </span>
                            <span className="flex items-center gap-1 text-amber-400">
                              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/30 border border-amber-400"></span>
                              DOWN ({mod.downPortNumbers.length})
                            </span>
                            <span className="flex items-center gap-1 text-red-400">
                              <span className="w-2.5 h-2.5 rounded-sm bg-red-500/30 border border-dashed border-red-500"></span>
                              MISSING ({mod.missingPortNumbers.length})
                            </span>
                          </div>
                        </div>

                        {/* Staggered RJ45 Grid */}
                        <div className="bg-[#14171f] p-3 rounded-md border border-[#262730] overflow-x-auto">
                          {/* Odd ports row (1, 3, 5...) */}
                          <div className="flex gap-1.5 mb-1.5">
                            {mod.allPortStatuses
                              .filter(p => p.portNumber % 2 !== 0)
                              .map(p => {
                                const isMissing = p.status === 'missing';
                                const isDown = p.status === 'down';
                                const isUp = p.status === 'up';

                                // Apply status filter visual dimming
                                const isDimmed =
                                  (portStatusFilter === 'missing' && !isMissing) ||
                                  (portStatusFilter === 'down' && !isDown) ||
                                  (portStatusFilter === 'up' && !isUp);

                                return (
                                  <div
                                    key={p.portNumber}
                                    onMouseEnter={() => setHoveredPort(p)}
                                    onMouseLeave={() => setHoveredPort(null)}
                                    className={`relative w-8 h-8 rounded flex flex-col items-center justify-center font-mono text-[10px] font-semibold transition-all cursor-pointer select-none ${
                                      isDimmed ? 'opacity-20' : 'hover:scale-115 hover:z-20'
                                    } ${
                                      isMissing
                                        ? 'bg-red-950/40 border-2 border-dashed border-red-500 text-red-300 shadow-[0_0_6px_rgba(239,68,68,0.2)]'
                                        : isDown
                                        ? 'bg-amber-500/20 border border-amber-400 text-amber-300 shadow-[0_0_6px_rgba(245,158,11,0.2)]'
                                        : 'bg-emerald-500/20 border border-emerald-400/80 text-emerald-300 shadow-[0_0_6px_rgba(16,185,129,0.2)]'
                                    }`}
                                  >
                                    <span>{p.portNumber}</span>
                                    {isMissing ? (
                                      <span className="text-[7px] text-red-400 leading-none">MIS</span>
                                    ) : isDown ? (
                                      <span className="text-[7px] text-amber-400 leading-none">DWN</span>
                                    ) : (
                                      <span className="text-[7px] text-emerald-400 leading-none">UP</span>
                                    )}
                                  </div>
                                );
                              })}
                          </div>

                          {/* Even ports row (2, 4, 6...) */}
                          <div className="flex gap-1.5">
                            {mod.allPortStatuses
                              .filter(p => p.portNumber % 2 === 0)
                              .map(p => {
                                const isMissing = p.status === 'missing';
                                const isDown = p.status === 'down';
                                const isUp = p.status === 'up';

                                const isDimmed =
                                  (portStatusFilter === 'missing' && !isMissing) ||
                                  (portStatusFilter === 'down' && !isDown) ||
                                  (portStatusFilter === 'up' && !isUp);

                                return (
                                  <div
                                    key={p.portNumber}
                                    onMouseEnter={() => setHoveredPort(p)}
                                    onMouseLeave={() => setHoveredPort(null)}
                                    className={`relative w-8 h-8 rounded flex flex-col items-center justify-center font-mono text-[10px] font-semibold transition-all cursor-pointer select-none ${
                                      isDimmed ? 'opacity-20' : 'hover:scale-115 hover:z-20'
                                    } ${
                                      isMissing
                                        ? 'bg-red-950/40 border-2 border-dashed border-red-500 text-red-300 shadow-[0_0_6px_rgba(239,68,68,0.2)]'
                                        : isDown
                                        ? 'bg-amber-500/20 border border-amber-400 text-amber-300 shadow-[0_0_6px_rgba(245,158,11,0.2)]'
                                        : 'bg-emerald-500/20 border border-emerald-400/80 text-emerald-300 shadow-[0_0_6px_rgba(16,185,129,0.2)]'
                                    }`}
                                  >
                                    <span>{p.portNumber}</span>
                                    {isMissing ? (
                                      <span className="text-[7px] text-red-400 leading-none">MIS</span>
                                    ) : isDown ? (
                                      <span className="text-[7px] text-amber-400 leading-none">DWN</span>
                                    ) : (
                                      <span className="text-[7px] text-emerald-400 leading-none">UP</span>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>

                        {/* Interactive Tooltip Card */}
                        {hoveredPort && (
                          <div className="bg-[#1e2129] border border-[#363945] p-3 rounded-md shadow-lg text-xs font-mono space-y-1.5 transition-all">
                            <div className="flex items-center justify-between border-b border-[#262730] pb-1">
                              <span className="font-bold text-white text-sm">
                                {hoveredPort.portName}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  hoveredPort.status === 'missing'
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                    : hoveredPort.status === 'down'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}
                              >
                                {hoveredPort.status.toUpperCase()}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                              <div>
                                <span className="text-[#808495] block text-[9px] uppercase">Oper Status:</span>
                                <span className={hoveredPort.status === 'down' ? 'text-amber-400' : 'text-emerald-400'}>
                                  {hoveredPort.operStatus || (hoveredPort.status === 'missing' ? 'Unlogged (Missing)' : 'up')}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#808495] block text-[9px] uppercase">Admin Status:</span>
                                <span className="text-white">{hoveredPort.adminStatus || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-[#808495] block text-[9px] uppercase">IP Address:</span>
                                <span className="text-sky-300">{hoveredPort.ipAddress || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-[#808495] block text-[9px] uppercase">MAC Address:</span>
                                <span className="text-purple-300">{hoveredPort.macAddress || 'N/A'}</span>
                              </div>
                            </div>

                            {hoveredPort.description && (
                              <div className="pt-1 text-[11px] text-[#a3a8b8]">
                                <span className="text-[#808495] text-[9px] uppercase block">Description:</span>
                                <span>{hoveredPort.description}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: DEDICATED MISSING & DOWN PORTS AUDIT TABLE */}
        {/* ========================================================================= */}
        {viewTab === 'missing_down_table' && (
          <div className="bg-[#1e2129] border border-[#262730] rounded-md overflow-hidden shadow-md space-y-2">
            <div className="px-4 py-3 border-b border-[#262730] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">
                  Missing & Down Ports Table
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] bg-[#262730] text-[#a3a8b8] font-mono">
                  {auditTableItems.length} ports matched
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#808495]" />
                <input
                  type="text"
                  value={auditTableSearch}
                  onChange={e => setAuditTableSearch(e.target.value)}
                  placeholder="Search rack, switch, port, IP, MAC..."
                  className="bg-[#262730] border border-[#363945] rounded pl-8 pr-2 py-1 text-xs text-white placeholder-[#808495] outline-none w-48 sm:w-64 focus:border-[#ff4b4b]"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-[460px] scrollbar-thin scrollbar-thumb-[#363945]">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-[#262730] bg-[#1a1c24] text-[#808495] sticky top-0 z-10">
                    <th className="py-2.5 px-3">Rack (FNR)</th>
                    <th className="py-2.5 px-3">Switch (S#)</th>
                    <th className="py-2.5 px-3">Port Name</th>
                    <th className="py-2.5 px-3">Audit State</th>
                    <th className="py-2.5 px-3">Oper Status</th>
                    <th className="py-2.5 px-3">Admin</th>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">MAC Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262730] text-[#dcdfe7]">
                  {auditTableItems.map((item, idx) => {
                    const isMissing = item.portDetail.status === 'missing';
                    const isDown = item.portDetail.status === 'down';

                    return (
                      <tr key={idx} className="hover:bg-[#262730]/70 transition-colors">
                        <td className="py-2 px-3 font-bold text-amber-400 whitespace-nowrap">
                          {item.rackId}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-white">
                          {item.switchId}
                        </td>
                        <td className="py-2 px-3 font-semibold text-white whitespace-nowrap">
                          {item.portDetail.portName}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {isMissing ? (
                            <span className="inline-flex items-center gap-1 bg-red-500/15 text-red-300 px-2 py-0.5 rounded text-[11px] font-semibold border border-red-500/30">
                              <AlertTriangle className="w-3 h-3" />
                              MISSING
                            </span>
                          ) : isDown ? (
                            <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-500/30">
                              <Activity className="w-3 h-3" />
                              DOWN
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded text-[11px] font-semibold border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              UP
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {isMissing ? (
                            <span className="text-[#808495] italic">Missing</span>
                          ) : isDown ? (
                            <span className="text-amber-400 font-semibold">down</span>
                          ) : (
                            <span className="text-emerald-400">up</span>
                          )}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-[#808495]">
                          {item.portDetail.adminStatus || '—'}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-sky-300">
                          {item.portDetail.ipAddress || '—'}
                        </td>
                        <td className="py-2 px-3 max-w-[200px] truncate text-[#a3a8b8]" title={item.portDetail.description || ''}>
                          {item.portDetail.description || '—'}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-purple-300">
                          {item.portDetail.macAddress || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
