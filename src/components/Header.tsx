import React from 'react';
import { SwitchCapacityMode } from '../utils/auditParser';
import {
  Network,
  Upload,
  RotateCcw,
  Sliders,
  Download,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';

interface HeaderProps {
  onOpenImport: () => void;
  onResetSample: () => void;
  capacityMode: SwitchCapacityMode;
  onChangeCapacityMode: (mode: SwitchCapacityMode) => void;
  onExportReport: () => void;
  totalRecords: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenImport,
  onResetSample,
  capacityMode,
  onChangeCapacityMode,
  onExportReport,
  totalRecords,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-xl backdrop-blur-md bg-slate-900/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & App Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-600/20">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Network Rack & Port Audit Mapper
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                FNR & S-Number Verification
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Audit missing port numbers across datacenter rack frames & switch stacks
            </p>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Switch Profile / Port Capacity Selector */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            <Sliders className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1.5" />
            <span className="text-slate-400 mr-2 text-[11px] hidden md:inline">Profile:</span>
            <button
              onClick={() => onChangeCapacityMode('auto')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                capacityMode === 'auto'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Automatically determine 24 vs 48 port capacity based on observed port numbers"
            >
              Auto (24/48P)
            </button>
            <button
              onClick={() => onChangeCapacityMode(48)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                capacityMode === 48
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              48-Port
            </button>
            <button
              onClick={() => onChangeCapacityMode(24)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                capacityMode === 24
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              24-Port
            </button>
          </div>

          {/* Import / Paste Button */}
          <button
            id="import-audit-data-btn"
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 shadow-md transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span>Import / Paste Data</span>
            <span className="px-1.5 py-0.2 bg-slate-950 text-[10px] text-slate-400 rounded-full ml-0.5">
              {totalRecords}
            </span>
          </button>

          {/* Export Report */}
          <button
            id="header-export-btn"
            onClick={onExportReport}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Audit CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
