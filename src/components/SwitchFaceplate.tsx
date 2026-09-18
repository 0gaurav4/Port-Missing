import React, { useState } from 'react';
import {
  SwitchAuditGroup,
  PortStatusItem,
} from '../types';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Maximize2,
  Info,
  Server,
  Zap,
} from 'lucide-react';

interface SwitchFaceplateProps {
  switchGroup: SwitchAuditGroup;
  onSelectPort?: (port: PortStatusItem) => void;
  selectedPort?: PortStatusItem | null;
}

export const SwitchFaceplate: React.FC<SwitchFaceplateProps> = ({
  switchGroup,
  onSelectPort,
  selectedPort,
}) => {
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hoveredPort, setHoveredPort] = useState<PortStatusItem | null>(null);

  // Base ports (module 0)
  const basePorts = switchGroup.ports.filter(p => p.moduleSlot === 0);
  const baseOddPorts = basePorts.filter(p => p.portNumber % 2 !== 0);
  const baseEvenPorts = basePorts.filter(p => p.portNumber % 2 === 0);

  // Uplink modules
  const uplinkPorts = switchGroup.ports.filter(p => p.moduleSlot > 0);

  const handleCopyMissing = () => {
    const missingNames = switchGroup.ports
      .filter(p => p.isMissing)
      .map(p => p.portId)
      .join(', ');
    navigator.clipboard.writeText(missingNames);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id={`switch-faceplate-${switchGroup.id}`}
      className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-xl overflow-hidden mb-6 transition-all"
    >
      {/* Switch Header Bar */}
      <div className="bg-slate-800/90 px-4 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-950 border border-slate-700 rounded-lg flex items-center justify-center">
            <Server className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Rack {switchGroup.rackId}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Switch {switchGroup.switchId}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-700 text-slate-300">
                Unit {switchGroup.switchUnit}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {switchGroup.deviceName}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Enterprise Managed Switch • {switchGroup.baseCapacity}-Port Base + {switchGroup.totalUplinkPorts} Uplink Ports
            </div>
          </div>
        </div>

        {/* Audit Status Pills & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {switchGroup.missingCount > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-950/60 border border-amber-500/40 rounded-full text-xs font-medium text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>
                <strong>{switchGroup.missingCount}</strong> Missing Ports
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/60 border border-emerald-500/40 rounded-full text-xs font-medium text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>All Ports Audited</span>
            </div>
          )}

          <div className="text-xs px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-full text-slate-300">
            Utilization: <strong>{switchGroup.utilizationRate}%</strong> ({switchGroup.configuredCount}/{switchGroup.totalPorts})
          </div>

          <button
            id={`filter-missing-toggle-${switchGroup.id}`}
            onClick={() => setFilterMissingOnly(!filterMissingOnly)}
            className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
              filterMissingOnly
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
            }`}
          >
            {filterMissingOnly ? 'Showing Missing Only' : 'Highlight Missing'}
          </button>

          {switchGroup.missingCount > 0 && (
            <button
              id={`copy-missing-btn-${switchGroup.id}`}
              onClick={handleCopyMissing}
              title="Copy missing ports to clipboard"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-800 text-slate-300 hover:text-white border border-slate-600 hover:bg-slate-700 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Missing'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Missing Port Ranges Callout (when missing ports exist) */}
      {switchGroup.missingCount > 0 && (
        <div className="bg-amber-950/30 border-b border-amber-900/40 px-4 py-2 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-amber-400 uppercase tracking-wide flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Missing Port Numbers on S{switchGroup.switchUnit}:
            </span>
            <span className="font-mono bg-amber-900/40 px-2 py-0.5 rounded text-amber-200 border border-amber-700/50">
              {switchGroup.missingBaseRangesText}
            </span>
            {switchGroup.modules.some(m => m.missingPorts.length > 0) && (
              <span className="text-slate-300">
                (Uplinks: {switchGroup.modules.map(m => m.missingRangesText).filter(t => t !== 'None').join(', ')})
              </span>
            )}
          </div>
          <span className="text-slate-400 text-[11px] hidden sm:inline">
            Click any port socket on faceplate to inspect details
          </span>
        </div>
      )}

      {/* PHYSICAL 1U RACK SWITCH FACEPLATE */}
      <div className="p-4 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-x-auto">
        <div className="min-w-[760px] bg-slate-950 border-2 border-slate-700 rounded-lg p-3 shadow-inner flex items-center gap-3">
          {/* Left Rack Ear & Diagnostic LEDs */}
          <div className="w-24 shrink-0 flex flex-col justify-between py-1 border-r border-slate-800 pr-3">
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 uppercase">
              <span>STACK</span>
              <span className="text-emerald-400 font-bold">U{switchGroup.switchUnit}</span>
            </div>
            {/* LED Status Matrix */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 my-2">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]"></span>
                <span className="text-[8px] font-mono text-slate-400">STAT</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span className="text-[8px] font-mono text-slate-400">SYST</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span className="text-[8px] font-mono text-slate-400">FAN</span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    switchGroup.missingCount > 0
                      ? 'bg-amber-400 animate-pulse shadow-[0_0_6px_#fbbf24]'
                      : 'bg-emerald-400'
                  }`}
                ></span>
                <span className="text-[8px] font-mono text-slate-400">AUDIT</span>
              </div>
            </div>
            <div className="text-[9px] font-mono text-slate-300 truncate">
              {switchGroup.rackId}-{switchGroup.switchId}
            </div>
          </div>

          {/* MAIN RJ45 PORT MATRIX (24 or 48 ports) */}
          <div className="flex-1 overflow-x-auto">
            <div className="text-[10px] font-mono text-slate-400 mb-1 flex items-center justify-between px-1">
              <span>BASE 10/100/1000 ETHERNET PORTS (SLOT 0)</span>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Present ({switchGroup.configuredBaseCount})
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                  <span className="w-2 h-2 rounded-full bg-amber-500 -ml-3"></span> Missing ({switchGroup.missingBaseCount})
                </span>
              </div>
            </div>

            {/* Switch Port Bank: Split into 12-port clusters (standard enterprise look) */}
            <div className="bg-slate-900 border border-slate-800 rounded p-2 flex gap-3">
              {Array.from({ length: Math.ceil(switchGroup.baseCapacity / 12) }).map((_, blockIdx) => {
                const startPort = blockIdx * 12 + 1;
                const endPort = Math.min((blockIdx + 1) * 12, switchGroup.baseCapacity);

                return (
                  <div
                    key={blockIdx}
                    className="bg-slate-950/80 border border-slate-800/80 rounded p-1.5 flex flex-col gap-1.5"
                  >
                    {/* Top Row: Odd Ports (1, 3, 5, 7, 9, 11...) */}
                    <div className="flex gap-1">
                      {Array.from({ length: 6 }).map((_, i) => {
                        const portNum = startPort + i * 2;
                        if (portNum > endPort) return null;
                        const port = basePorts.find(p => p.portNumber === portNum);
                        if (!port) return null;
                        return renderPortSocket(port);
                      })}
                    </div>

                    {/* Bottom Row: Even Ports (2, 4, 6, 8, 10, 12...) */}
                    <div className="flex gap-1">
                      {Array.from({ length: 6 }).map((_, i) => {
                        const portNum = startPort + 1 + i * 2;
                        if (portNum > endPort) return null;
                        const port = basePorts.find(p => p.portNumber === portNum);
                        if (!port) return null;
                        return renderPortSocket(port);
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* UPLINK EXPANSION MODULE CAGES (SFP+ / QSFP) */}
          {uplinkPorts.length > 0 && (
            <div className="w-36 shrink-0 border-l border-slate-800 pl-3">
              <div className="text-[10px] font-mono text-slate-400 mb-1 flex items-center justify-between">
                <span>UPLINK / SFP</span>
                <span className="text-[9px] text-sky-400">SLOT 1</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded p-2 grid grid-cols-2 gap-1.5">
                {uplinkPorts.map(port => renderUplinkSocket(port))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Tooltip / Detail Footer */}
      <div className="bg-slate-950/80 px-4 py-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          {hoveredPort ? (
            <div className="flex items-center gap-2 animate-fadeIn">
              <span className="font-mono font-bold text-slate-200">{hoveredPort.portId}</span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  hoveredPort.isMissing
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {hoveredPort.isMissing ? 'MISSING FROM AUDIT' : `CONFIGURED (Sl #${hoveredPort.auditSlNo || 'N/A'})`}
              </span>
              <span className="text-slate-400">
                Speed: <strong>{hoveredPort.speedCategory}</strong> • Unit: <strong>{hoveredPort.switchUnit}</strong> • Port: <strong>{hoveredPort.portNumber}</strong>
              </span>
            </div>
          ) : (
            <span className="text-slate-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              Hover or click on any port above to inspect network audit and physical mapping status.
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-slate-400">
            Rack: <strong className="text-slate-300">{switchGroup.rackId}</strong>
          </span>
          <span className="text-slate-400">
            Switch: <strong className="text-slate-300">{switchGroup.switchId}</strong>
          </span>
        </div>
      </div>
    </div>
  );

  /**
   * Helper to render an individual RJ45 port socket
   */
  function renderPortSocket(port: PortStatusItem) {
    const isSelected = selectedPort?.portId === port.portId;
    const isMissing = port.isMissing;
    const isDimmed = filterMissingOnly && !isMissing;

    return (
      <button
        key={port.canonicalId}
        id={`port-btn-${port.portId.replace(/[^a-zA-Z0-9]/g, '-')}`}
        onClick={() => onSelectPort && onSelectPort(port)}
        onMouseEnter={() => setHoveredPort(port)}
        onMouseLeave={() => setHoveredPort(null)}
        title={`${port.portId} - ${isMissing ? 'MISSING' : 'CONFIGURED'}`}
        className={`relative group w-8 h-8 rounded flex flex-col items-center justify-between p-0.5 transition-all cursor-pointer select-none ${
          isDimmed
            ? 'opacity-20 hover:opacity-100 bg-slate-900/60 border border-slate-800'
            : isMissing
            ? 'bg-amber-950/80 border-2 border-amber-500/90 shadow-[0_0_8px_rgba(245,158,11,0.4)] ring-1 ring-amber-400/50 hover:scale-110 z-10'
            : 'bg-slate-800 hover:bg-slate-700 border border-slate-600/80 hover:border-emerald-400'
        } ${isSelected ? 'ring-2 ring-sky-400 scale-110 z-20' : ''}`}
      >
        {/* Status LED */}
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isMissing
              ? 'bg-amber-400 animate-pulse shadow-[0_0_4px_#fbbf24]'
              : 'bg-emerald-400 shadow-[0_0_4px_#34d399]'
          }`}
        />

        {/* RJ45 Port Socket Graphic Notch */}
        <div
          className={`w-4 h-2.5 rounded-t-sm flex items-end justify-center ${
            isMissing
              ? 'bg-amber-900/80 border border-amber-600/60'
              : 'bg-slate-950 border border-slate-700'
          }`}
        >
          <div className="w-2 h-1 bg-slate-800 rounded-t-xs"></div>
        </div>

        {/* Port Number Label */}
        <span
          className={`text-[8px] font-mono leading-none font-bold ${
            isMissing ? 'text-amber-300' : 'text-slate-300'
          }`}
        >
          {port.portNumber}
        </span>
      </button>
    );
  }

  /**
   * Helper to render an Uplink SFP+ / QSFP socket
   */
  function renderUplinkSocket(port: PortStatusItem) {
    const isSelected = selectedPort?.portId === port.portId;
    const isMissing = port.isMissing;
    const isDimmed = filterMissingOnly && !isMissing;

    return (
      <button
        key={port.canonicalId}
        id={`uplink-btn-${port.portId.replace(/[^a-zA-Z0-9]/g, '-')}`}
        onClick={() => onSelectPort && onSelectPort(port)}
        onMouseEnter={() => setHoveredPort(port)}
        onMouseLeave={() => setHoveredPort(null)}
        title={`${port.portId} (${port.speedCategory}) - ${isMissing ? 'MISSING' : 'CONFIGURED'}`}
        className={`relative group w-14 h-9 rounded flex flex-col items-center justify-between p-1 transition-all cursor-pointer ${
          isDimmed
            ? 'opacity-25 bg-slate-900 border border-slate-800'
            : isMissing
            ? 'bg-amber-950/80 border-2 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] ring-1 ring-amber-400 hover:scale-105'
            : 'bg-slate-800 hover:bg-slate-700 border border-sky-600/60 hover:border-sky-400'
        } ${isSelected ? 'ring-2 ring-sky-400 scale-105' : ''}`}
      >
        <div className="flex items-center justify-between w-full">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isMissing ? 'bg-amber-400 animate-pulse' : 'bg-sky-400'
            }`}
          />
          <span className="text-[7px] font-mono text-slate-400">
            {port.speedCategory}
          </span>
        </div>

        {/* SFP Metal Cage Notch */}
        <div
          className={`w-9 h-3 rounded-xs flex items-center justify-center ${
            isMissing ? 'bg-amber-900 border border-amber-600' : 'bg-slate-950 border border-slate-700'
          }`}
        >
          <div className="w-5 h-1 bg-slate-700 rounded-xs"></div>
        </div>

        <span
          className={`text-[8px] font-mono leading-none ${
            isMissing ? 'text-amber-300 font-bold' : 'text-slate-300'
          }`}
        >
          {port.switchUnit}/{port.moduleSlot}/{port.portNumber}
        </span>
      </button>
    );
  }
};
