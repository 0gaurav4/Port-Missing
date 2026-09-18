import React, { useState } from 'react';
import { RawAuditRow } from '../types';
import { SAMPLE_AUDIT_DATA } from '../data/sampleAuditData';
import { parseRawTextInput } from '../utils/auditParser';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  Clipboard,
  CheckCircle2,
  X,
  AlertCircle,
  FileText,
  RotateCcw,
} from 'lucide-react';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportData: (rows: RawAuditRow[]) => void;
  currentCount: number;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({
  isOpen,
  onClose,
  onImportData,
  currentCount,
}) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'upload' | 'preset'>('paste');
  const [pastedText, setPastedText] = useState('');
  const [previewRows, setPreviewRows] = useState<RawAuditRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPastedText(val);
    setErrorMsg(null);
    if (val.trim()) {
      const parsed = parseRawTextInput(val);
      setPreviewRows(parsed);
    } else {
      setPreviewRows([]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });

        // Convert array of arrays to RawAuditRow
        const rows: RawAuditRow[] = [];
        let headerSl = 0;
        let headerDev = 1;
        let headerPort = 2;

        if (jsonData.length > 0) {
          const firstRow = (jsonData[0] as any[]).map(c => String(c).toLowerCase());
          const devIdx = firstRow.findIndex(c => c.includes('device') || c.includes('host'));
          const portIdx = firstRow.findIndex(c => c.includes('port') || c.includes('interface'));
          const slIdx = firstRow.findIndex(c => c.includes('sl') || c.includes('no') || c.includes('id'));

          if (devIdx !== -1) headerDev = devIdx;
          if (portIdx !== -1) headerPort = portIdx;
          if (slIdx !== -1) headerSl = slIdx;
        }

        const startIndex = jsonData.length > 1 ? 1 : 0;
        for (let i = startIndex; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;
          const dev = row[headerDev] ? String(row[headerDev]).trim() : '';
          const prt = row[headerPort] ? String(row[headerPort]).trim() : '';
          const sl = row[headerSl] ? String(row[headerSl]).trim() : i;

          if (dev && prt) {
            rows.push({
              slNo: sl,
              deviceName: dev,
              port: prt,
            });
          }
        }

        setPreviewRows(rows);
      } else {
        // Plain text / CSV / TSV
        const text = await file.text();
        const parsed = parseRawTextInput(text);
        setPreviewRows(parsed);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to parse file: ${err.message || 'Invalid format'}`);
    }
  };

  const handleApply = () => {
    if (previewRows.length === 0) {
      setErrorMsg('No valid audit rows parsed. Please verify the format.');
      return;
    }
    onImportData(previewRows);
    onClose();
  };

  const handleLoadSample = () => {
    onImportData(SAMPLE_AUDIT_DATA);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-slate-800/90 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Import Network Audit Spreadsheet Data
              </h3>
              <p className="text-xs text-slate-400">
                Upload or paste rows from your network switch audit spreadsheet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('paste')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'paste'
                ? 'bg-slate-900 text-sky-400 border-t-2 border-sky-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            Paste from Excel/Sheets
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-slate-900 text-sky-400 border-t-2 border-sky-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Upload File (.xlsx, .csv)
          </button>
          <button
            onClick={() => setActiveTab('preset')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'preset'
                ? 'bg-slate-900 text-sky-400 border-t-2 border-sky-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Sample Audit Data
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {activeTab === 'paste' && (
            <div>
              <div className="text-xs text-slate-300 mb-2 flex items-center justify-between">
                <span>
                  Copy rows from Excel or Google Sheets (e.g. columns: <code>Sl.No</code>, <code>Device Name</code>, <code>Port</code>) and paste here:
                </span>
                <span className="text-[11px] text-slate-400">TSV / CSV supported</span>
              </div>
              <textarea
                id="paste-data-textarea"
                rows={8}
                value={pastedText}
                onChange={handlePasteChange}
                placeholder={`1\tCCS1N1F1FNR8AS1.cgv.nic.in\tTenGigabitEthernet1/0/47\n2\tCCS1N1F1FNR8AS1.cgv.nic.in\tTenGigabitEthernet1/0/46\n6\tCCS1N1F1FNR8AS1.cgv.nic.in\tGigabitEthernet3/0/38\n...`}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 leading-relaxed"
              />
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center hover:border-sky-500/70 transition-colors bg-slate-950/40">
              <FileSpreadsheet className="w-10 h-10 text-sky-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-200 mb-1">
                Drop your audit spreadsheet here
              </p>
              <p className="text-xs text-slate-400 mb-4">
                Supports Microsoft Excel (.xlsx, .xls) and CSV / TSV export files
              </p>
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-colors">
                <Upload className="w-4 h-4" />
                <span>Browse File</span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {fileName && (
                <div className="mt-3 text-xs text-emerald-400 flex items-center justify-center gap-1.5 font-mono">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Loaded file: {fileName}</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'preset' && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <FileText className="w-6 h-6 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-200">
                    NIC CGV Datacenter Audit Dataset
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Loads the exact audit rows from your uploaded screenshot:
                  </p>
                  <ul className="text-xs text-slate-300 mt-2 space-y-1 list-disc list-inside font-mono">
                    <li>Device <code>CCS1N1F1FNR8AS1.cgv.nic.in</code> (Rack FNR 8, Switch AS1, Units 1, 2, 3)</li>
                    <li>Device <code>CCS3N1F3FNR5AS1.cgv.nic.in</code> (Rack FNR 5, Switch AS1, Units 2, 3)</li>
                    <li>Total 138 audit entries with 1G, 10G, 25G, and 40G interfaces</li>
                  </ul>
                  <button
                    onClick={handleLoadSample}
                    className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    Load Screenshot Audit Dataset
                  </button>
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {previewRows.length > 0 && activeTab !== 'preset' && (
            <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Parsed {previewRows.length} valid audit rows!
              </span>
              <span className="text-slate-400">
                Ready to calculate missing ports across all racks and switches.
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-800/90 px-6 py-4 border-t border-slate-700 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Current audit data has <strong>{currentCount}</strong> records loaded.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            {activeTab !== 'preset' && (
              <button
                id="apply-import-btn"
                onClick={handleApply}
                disabled={previewRows.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-lg transition-colors"
              >
                Apply & Calculate Missing Ports ({previewRows.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
