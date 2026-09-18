import React from 'react';
import { AuditAnalysisResult } from '../types';
import {
  Layers,
  Server,
  CheckCircle2,
  AlertTriangle,
  Percent,
} from 'lucide-react';

interface MetricCardsProps {
  analysis: AuditAnalysisResult;
  onFilterMissingToggle?: () => void;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ analysis }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Racks (FNR) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Audited Racks (FNR)
          </span>
          <div className="text-2xl font-bold text-white mt-1">
            {analysis.racks.length}{' '}
            <span className="text-xs font-normal text-slate-400">Racks</span>
          </div>
          <div className="text-[11px] text-amber-400 mt-1 font-mono">
            {analysis.rackIds.join(', ')}
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <Layers className="w-5 h-5" />
        </div>
      </div>

      {/* Total Switches (S-Numbers & Units) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Switches Audited (S#)
          </span>
          <div className="text-2xl font-bold text-white mt-1">
            {analysis.allSwitches.length}{' '}
            <span className="text-xs font-normal text-slate-400">Units / Members</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {analysis.totalExpectedPorts} Total Port Sockets
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
          <Server className="w-5 h-5" />
        </div>
      </div>

      {/* Configured / Audited Ports */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Configured Ports in Log
          </span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {analysis.totalConfiguredPorts}
          </div>
          <div className="text-[11px] text-emerald-400/80 mt-1">
            {analysis.coveragePercentage}% Audit Utilization Rate
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </div>

      {/* Missing Ports Highlight */}
      <div className="bg-gradient-to-br from-amber-950/60 to-slate-900 border-2 border-amber-500/40 rounded-2xl p-4 shadow-xl flex items-center justify-between">
        <div>
          <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Missing Port Numbers
          </span>
          <div className="text-2xl font-bold text-amber-400 mt-1 flex items-baseline gap-2">
            {analysis.totalMissingPorts}
            <span className="text-xs font-normal text-amber-300/80">Unlogged Sockets</span>
          </div>
          <div className="text-[11px] text-amber-300/70 mt-1">
            Requires physical datacenter audit
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
          <AlertTriangle className="w-6 h-6 animate-pulse" />
        </div>
      </div>
    </div>
  );
};
