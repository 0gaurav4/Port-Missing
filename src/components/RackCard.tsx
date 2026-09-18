import React, { useState } from 'react';
import { RackAuditGroup, PortStatusItem } from '../types';
import { SwitchFaceplate } from './SwitchFaceplate';
import {
  Layers,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Server,
  FileSpreadsheet,
} from 'lucide-react';

interface RackCardProps {
  rack: RackAuditGroup;
  onSelectPort?: (port: PortStatusItem) => void;
  selectedPort?: PortStatusItem | null;
  onFilterRack?: (rackId: string) => void;
}

export const RackCard: React.FC<RackCardProps> = ({
  rack,
  onSelectPort,
  selectedPort,
  onFilterRack,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div
      id={`rack-card-${rack.rackId}`}
      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 mb-8 shadow-2xl backdrop-blur-sm"
    >
      {/* Rack Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-sky-500/20 border border-slate-700 flex items-center justify-center text-amber-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Rack {rack.rackId}
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  FNR #{rack.rackNumber}
                </span>
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
              <span>{rack.devices.length} Network Device(s):</span>
              {rack.devices.map(d => (
                <code key={d} className="px-1.5 py-0.5 rounded bg-slate-950 text-sky-300 text-[11px] border border-slate-800">
                  {d}
                </code>
              ))}
            </div>
          </div>
        </div>

        {/* Rack Aggregate Statistics */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <Server className="w-4 h-4 text-sky-400" />
            <div>
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Switches</div>
              <div className="font-bold text-slate-200">{rack.totalSwitches} Units (S#)</div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Audited Ports</div>
              <div className="font-bold text-emerald-400">{rack.totalConfiguredPorts}</div>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${
              rack.totalMissingPorts > 0
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 ${rack.totalMissingPorts > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
            <div>
              <div className="text-[10px] uppercase font-semibold">Missing Ports</div>
              <div className="font-bold">{rack.totalMissingPorts} Ports</div>
            </div>
          </div>

          {onFilterRack && (
            <button
              id={`filter-rack-btn-${rack.rackId}`}
              onClick={() => onFilterRack(rack.rackId)}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors"
            >
              Isolate Rack
            </button>
          )}

          <button
            id={`toggle-rack-collapse-${rack.rackId}`}
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
            title={isExpanded ? 'Collapse Rack Switches' : 'Expand Rack Switches'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Switch Units Summary Strip */}
      <div className="mt-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        {rack.switches.map(sw => (
          <div
            key={sw.id}
            className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-xs text-slate-200">
                Switch {sw.switchId} (Unit {sw.switchUnit})
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  sw.missingCount > 0
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {sw.missingCount > 0 ? `${sw.missingCount} Missing` : 'Complete'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mb-1.5 truncate">
              {sw.configuredCount}/{sw.totalPorts} ports audited ({sw.utilizationRate}% utilized)
            </div>
            <div className="text-[11px] font-mono text-amber-300/90 bg-slate-900 px-2 py-1 rounded border border-slate-800/80 truncate">
              Missing: {sw.missingBaseRangesText}
            </div>
          </div>
        ))}
      </div>

      {/* Individual Switch Faceplates */}
      {isExpanded && (
        <div className="space-y-4 mt-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Physical Switch Faceplates & Port Mapping</span>
            <span className="text-slate-400 normal-case">
              Front Panel RJ45 Ports & Expansion Modules
            </span>
          </div>
          {rack.switches.map(sw => (
            <SwitchFaceplate
              key={sw.id}
              switchGroup={sw}
              onSelectPort={onSelectPort}
              selectedPort={selectedPort}
            />
          ))}
        </div>
      )}
    </div>
  );
};
