import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { GenericParsedTable, ModuleMissingAudit } from '../types';
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
  FileText,
} from 'lucide-react';

export const StreamlitSwitchportView: React.FC = () => {
  // Input raw text, initialized with sample data
  const [rawText, setRawText] = useState<string>(SAMPLE_PORT_SECURITY_TEXT);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [capacityMode, setCapacityMode] = useState<SwitchCapacityMode>('auto');
  
  // Table search & pagination state
  const [tableSearch, setTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Accordion open states for modules
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({
    'Gi1/0': true, // Open first module by default like screenshot
  });

  // Copied toast state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse raw text into generic table
  const parsedTable: GenericParsedTable = useMemo(() => {
    return parseGenericTableData(rawText);
  }, [rawText]);

  // Analyze missing ports across modules
  const analysis = useMemo(() => {
    return analyzeModulesMissingPorts(parsedTable, capacityMode);
  }, [parsedTable, capacityMode]);

  // Set initial open module if none open
  React.useEffect(() => {
    if (analysis.modules.length > 0 && Object.keys(openModules).length === 0) {
      setOpenModules({ [analysis.modules[0].moduleId]: true });
    }
  }, [analysis.modules]);

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
        }
      };
      reader.onerror = () => {
        setUploadError('Failed to read file.');
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  // Export full missing ports CSV
  const handleExportCSV = () => {
    const headers = [
      'Module',
      'Rack (FNR)',
      'Switch (S-Number)',
      'Device Name',
      'Port Identifier',
      'Port Number',
      'Status',
    ];

    const rows: string[][] = [];
    analysis.modules.forEach(mod => {
      mod.missingPortNumbers.forEach((num: number) => {
        rows.push([
          mod.modulePrefix,
          mod.rackId || 'N/A',
          mod.switchId || 'N/A',
          mod.deviceName || 'N/A',
          `${mod.modulePrefix}/${num}`,
          num.toString(),
          'MISSING FROM LOG',
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
    link.download = `missing-ports-analysis.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 text-[#f0f2f6]">
      {/* Streamlit-Style Title Bar */}
      <div className="border-b border-[#262730] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="text-[#ff4b4b]">●</span> Switchport Missing Port Analyzer
            </h1>
            <p className="text-xs text-[#a3a8b8] mt-1">
              Analyze Cisco switchport CLI outputs, Excel sheets, or audit tables to identify missing port sequences
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
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  capacityMode === 'auto'
                    ? 'bg-[#ff4b4b] text-white font-semibold shadow'
                    : 'text-[#a3a8b8] hover:text-white'
                }`}
                title="Automatically determine 24 vs 48 port capacity"
              >
                Auto (24/48P)
              </button>
              <button
                onClick={() => setCapacityMode(48)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  capacityMode === 48
                    ? 'bg-[#ff4b4b] text-white font-semibold shadow'
                    : 'text-[#a3a8b8] hover:text-white'
                }`}
              >
                48-Port
              </button>
              <button
                onClick={() => setCapacityMode(24)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  capacityMode === 24
                    ? 'bg-[#ff4b4b] text-white font-semibold shadow'
                    : 'text-[#a3a8b8] hover:text-white'
                }`}
              >
                24-Port
              </button>
            </div>

            {/* Export CSV button */}
            {analysis.totalMissingPorts > 0 && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#262730] hover:bg-[#363945] border border-[#464b5d] text-white rounded-md text-xs font-medium transition-colors cursor-pointer"
                title="Export missing ports report as CSV"
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
            placeholder="Paste raw output here or click 'Upload File' at the top...&#10;Gi1/0/1    2    1    13189    Restrict&#10;Gi1/0/2    1    1    689394   Restrict&#10;...or TSV / Excel columns with Device Name & Port"
            rows={7}
            className="w-full bg-[#1e2129] border border-[#363945] focus:border-[#ff4b4b] focus:ring-1 focus:ring-[#ff4b4b] rounded-md p-3 font-mono text-xs text-[#f0f2f6] placeholder-[#555a6d] outline-none transition-colors resize-y shadow-inner leading-relaxed"
          />
        </div>
      </div>

      {/* Streamlit Green Parse Status Box (Exact Match to Screenshot) */}
      {parsedTable.totalRows > 0 && (
        <div
          id="parsed-status-badge"
          className="bg-[#0f2d1d] border border-[#21c354]/40 text-[#21c354] px-4 py-2.5 rounded-md text-sm font-medium flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#21c354] animate-pulse"></span>
            <span>
              Parsed {parsedTable.totalRows} rows with {parsedTable.totalColumns} columns
            </span>
          </div>
          <span className="text-xs text-[#21c354]/80 font-mono hidden sm:inline">
            Port column: {parsedTable.portColumnName}
          </span>
        </div>
      )}

      {/* Streamlit DataFrame Interactive Table (Exact Match to Screenshot) */}
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
          <div className="overflow-x-auto max-h-[360px] scrollbar-thin scrollbar-thumb-[#363945]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#262730] bg-[#1a1c24] text-[#808495] sticky top-0 z-10 font-mono">
                  {/* Streamlit row index column */}
                  <th className="py-2 px-3.5 w-12 text-center text-[#555a6d] font-normal border-r border-[#262730]">
                    #
                  </th>
                  {parsedTable.headers.map((col, idx) => (
                    <th
                      key={idx}
                      className={`py-2 px-3.5 font-semibold text-white ${
                        col === parsedTable.portColumnName
                          ? 'text-[#ff4b4b] bg-[#ff4b4b]/5'
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
                      {/* Row index (0, 1, 2...) matching screenshot */}
                      <td className="py-1.5 px-3 text-center text-[#555a6d] text-[11px] border-r border-[#262730] bg-[#1a1c24]/50 select-none">
                        {absoluteIndex}
                      </td>
                      {parsedTable.headers.map((col, cIdx) => {
                        const val = row[col] || '';
                        const isPort = col === parsedTable.portColumnName;
                        return (
                          <td
                            key={cIdx}
                            className={`py-1.5 px-3.5 whitespace-nowrap ${
                              isPort ? 'font-semibold text-white' : ''
                            }`}
                          >
                            {val}
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
                className="px-2 py-0.5 rounded bg-[#262730] hover:bg-[#363945] disabled:opacity-40 disabled:hover:bg-[#262730] text-[#a3a8b8] transition-colors"
              >
                Previous
              </button>
              <span className="px-2 text-white">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-2 py-0.5 rounded bg-[#262730] hover:bg-[#363945] disabled:opacity-40 disabled:hover:bg-[#262730] text-[#a3a8b8] transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MISSING PORTS ANALYSIS SECTION (Exact Match to Screenshot) */}
      <div className="pt-2 space-y-4">
        {/* Section Heading */}
        <h2 className="text-xl font-bold text-white tracking-tight">
          Missing Ports Analysis
        </h2>

        {/* Streamlit Olive/Amber Banner (Exact Match to Screenshot) */}
        {analysis.modulesWithMissingCount > 0 ? (
          <div
            id="missing-ports-detected-banner"
            className="bg-[#2d2915] border border-[#b89c30]/50 text-[#f6e07a] px-4 py-3 rounded-md text-sm font-medium flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#ffe066] shrink-0" />
              <span>
                Missing ports detected across {analysis.modulesWithMissingCount} module(s)
              </span>
            </div>
            <span className="text-xs bg-[#b89c30]/20 px-2 py-0.5 rounded text-[#ffe066] font-mono">
              {analysis.totalMissingPorts} total unlogged ports
            </span>
          </div>
        ) : (
          <div className="bg-[#0f2d1d] border border-[#21c354]/40 text-[#21c354] px-4 py-3 rounded-md text-sm font-medium flex items-center gap-2.5">
            <Check className="w-4 h-4 text-[#21c354]" />
            <span>
              All ports accounted for! No missing ports detected across modules.
            </span>
          </div>
        )}

        {/* Collapsible Module Expanders (Exact Match to Screenshot `v Gi1/0 — 3 missing ports`) */}
        <div className="space-y-3">
          {analysis.modules.map(mod => {
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
                  className="w-full px-4 py-3 bg-[#262730] hover:bg-[#2c2e3a] flex items-center justify-between text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5 font-medium text-sm">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-[#ff4b4b]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#808495]" />
                    )}
                    <span className="text-white font-mono font-bold">
                      {mod.modulePrefix}
                    </span>
                    <span className="text-[#808495]">—</span>
                    <span
                      className={
                        hasMissing
                          ? 'text-[#ffe066] font-semibold'
                          : 'text-[#21c354]'
                      }
                    >
                      {hasMissing
                        ? `${mod.missingPortNumbers.length} missing port${
                            mod.missingPortNumbers.length > 1 ? 's' : ''
                          }`
                        : 'Fully configured (0 missing)'}
                    </span>

                    {/* Show Rack (FNR) & Switch (S#) badge if present */}
                    {mod.rackId && (
                      <span className="ml-2 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono hidden sm:inline">
                        Rack {mod.rackId} • Switch {mod.switchId}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#808495] font-mono hidden sm:inline">
                      {mod.configuredPortNumbers.length} / {mod.capacity} ports logged
                    </span>
                  </div>
                </button>

                {/* Accordion Content */}
                {isOpen && (
                  <div className="p-4 space-y-4 border-t border-[#262730] bg-[#1a1c24]/50">
                    {/* Module Metadata Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                      <div className="bg-[#1e2129] p-2.5 rounded border border-[#262730]">
                        <span className="text-[#808495] block text-[10px] uppercase font-semibold">
                          Rack (FNR) & Switch (S#)
                        </span>
                        <span className="font-mono font-bold text-amber-400 mt-0.5 block">
                          {mod.rackId || 'General Switch'} / {mod.switchId || 'Unit ' + mod.switchUnit}
                        </span>
                      </div>

                      <div className="bg-[#1e2129] p-2.5 rounded border border-[#262730]">
                        <span className="text-[#808495] block text-[10px] uppercase font-semibold">
                          Switch Capacity
                        </span>
                        <span className="font-mono font-bold text-white mt-0.5 block">
                          {mod.capacity} Ports (Slot {mod.moduleSlot})
                        </span>
                      </div>

                      <div className="bg-[#1e2129] p-2.5 rounded border border-[#262730]">
                        <span className="text-[#808495] block text-[10px] uppercase font-semibold">
                          Configured Ports
                        </span>
                        <span className="font-mono font-bold text-[#21c354] mt-0.5 block">
                          {mod.configuredPortNumbers.length} ports logged
                        </span>
                      </div>

                      <div className="bg-[#1e2129] p-2.5 rounded border border-[#262730]">
                        <span className="text-[#808495] block text-[10px] uppercase font-semibold">
                          Missing Port Count
                        </span>
                        <span className="font-mono font-bold text-[#ffe066] mt-0.5 block">
                          {mod.missingPortNumbers.length} unlogged sockets
                        </span>
                      </div>
                    </div>

                    {/* Missing Port Ranges & Quick Copy */}
                    {hasMissing ? (
                      <div className="space-y-3">
                        {/* Missing Ranges Box */}
                        <div className="bg-[#262730] border border-[#363945] rounded-md p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-semibold text-[#ffe066] flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-[#ffe066]" />
                              Missing Port Ranges:
                            </span>
                            <button
                              onClick={() =>
                                handleCopy(
                                  mod.missingPortStrings.join(', '),
                                  `ports-${mod.moduleId}`
                                )
                              }
                              className="flex items-center gap-1 px-2 py-1 bg-[#1e2129] hover:bg-[#363945] text-xs text-[#dcdfe7] rounded transition-colors"
                            >
                              {copiedKey === `ports-${mod.moduleId}` ? (
                                <>
                                  <Check className="w-3 h-3 text-[#21c354]" />
                                  <span className="text-[#21c354]">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Missing Ports</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="font-mono text-xs text-white bg-[#1e2129] p-2 rounded border border-[#363945] break-words">
                            {mod.missingRangesText}
                          </div>
                          <div className="text-[11px] text-[#808495] mt-1.5">
                            Individual ports: {mod.missingPortStrings.slice(0, 15).join(', ')}
                            {mod.missingPortStrings.length > 15 && ` ...and ${mod.missingPortStrings.length - 15} more`}
                          </div>
                        </div>

                        {/* Cisco CLI Interface Range Command */}
                        {mod.ciscoRangeCommand && (
                          <div className="bg-[#1e2129] border border-[#363945] rounded-md p-3">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-xs font-semibold text-[#a3a8b8] flex items-center gap-1">
                                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                                Cisco CLI Configuration Range:
                              </span>
                              <button
                                onClick={() =>
                                  handleCopy(
                                    mod.ciscoRangeCommand,
                                    `cli-${mod.moduleId}`
                                  )
                                }
                                className="flex items-center gap-1 px-2 py-0.5 bg-[#262730] hover:bg-[#363945] text-xs text-sky-300 rounded transition-colors"
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

                        {/* Visual Port Sequence Matrix (Mini RJ45 Faceplate) */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-xs text-[#808495]">
                            <span className="font-medium">
                              Visual Port Sequence (1..{mod.capacity}):
                            </span>
                            <div className="flex items-center gap-3 text-[11px]">
                              <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-sm bg-[#21c354]/40 border border-[#21c354]"></span>
                                Configured ({mod.configuredPortNumbers.length})
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-sm bg-[#ffe066]/40 border border-[#ffe066]"></span>
                                Missing ({mod.missingPortNumbers.length})
                              </span>
                            </div>
                          </div>

                          {/* 48/24-port RJ45 staggered grid */}
                          <div className="bg-[#14171f] p-2.5 rounded-md border border-[#262730] overflow-x-auto">
                            {/* Odd ports row (1, 3, 5...) */}
                            <div className="flex gap-1 mb-1">
                              {mod.allPortStatuses
                                .filter((p: { portNumber: number; portName: string; isConfigured: boolean }) => p.portNumber % 2 !== 0)
                                .map((p: { portNumber: number; portName: string; isConfigured: boolean }) => (
                                  <div
                                    key={p.portNumber}
                                    title={`${p.portName}: ${p.isConfigured ? 'Configured in audit' : 'MISSING'}`}
                                    className={`w-7 h-7 rounded flex items-center justify-center font-mono text-[10px] font-semibold border transition-transform hover:scale-110 cursor-pointer ${
                                      p.isConfigured
                                        ? 'bg-[#21c354]/15 border-[#21c354]/40 text-[#21c354]'
                                        : 'bg-[#ffe066]/20 border-[#ffe066] text-[#ffe066] shadow-[0_0_8px_rgba(255,224,102,0.3)] animate-pulse'
                                    }`}
                                  >
                                    {p.portNumber}
                                  </div>
                                ))}
                            </div>

                            {/* Even ports row (2, 4, 6...) */}
                            <div className="flex gap-1">
                              {mod.allPortStatuses
                                .filter((p: { portNumber: number; portName: string; isConfigured: boolean }) => p.portNumber % 2 === 0)
                                .map((p: { portNumber: number; portName: string; isConfigured: boolean }) => (
                                  <div
                                    key={p.portNumber}
                                    title={`${p.portName}: ${p.isConfigured ? 'Configured in audit' : 'MISSING'}`}
                                    className={`w-7 h-7 rounded flex items-center justify-center font-mono text-[10px] font-semibold border transition-transform hover:scale-110 cursor-pointer ${
                                      p.isConfigured
                                        ? 'bg-[#21c354]/15 border-[#21c354]/40 text-[#21c354]'
                                        : 'bg-[#ffe066]/20 border-[#ffe066] text-[#ffe066] shadow-[0_0_8px_rgba(255,224,102,0.3)] animate-pulse'
                                    }`}
                                  >
                                    {p.portNumber}
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-[#21c354] bg-[#0f2d1d] p-3 rounded border border-[#21c354]/30 flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        <span>All ports in {mod.modulePrefix} are logged in audit sequence.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
