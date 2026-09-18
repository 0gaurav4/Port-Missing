import React, { useState } from 'react';
import { PortStatusItem } from '../types';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Terminal,
  MapPin,
  Server,
  Cable,
} from 'lucide-react';

interface PortDetailModalProps {
  port: PortStatusItem | null;
  onClose: () => void;
}

export const PortDetailModal: React.FC<PortDetailModalProps> = ({ port, onClose }) => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!port) return null;

  const cliStatusCommand = `show interface ${port.portId} status`;
  const cliConfigCommand = `show running-config interface ${port.portId}`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-800/90 px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg ${
                port.isMissing
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {port.isMissing ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                {port.portId}
              </h3>
              <p className="text-xs text-slate-400">
                Physical Port Mapping & Audit Verification
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

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Status Badge */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between ${
              port.isMissing
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  port.isMissing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
                }`}
              />
              <span className="text-xs font-bold uppercase tracking-wider">
                {port.isMissing ? 'MISSING FROM AUDIT SPREADSHEET' : 'AUDITED & ACTIVE'}
              </span>
            </div>
            {port.auditSlNo && (
              <span className="text-xs font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                Audit Sl #{port.auditSlNo}
              </span>
            )}
          </div>

          {/* Physical Location Mapping Grid */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
              <span>Physical Datacenter Mapping</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-300">
              <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Rack Number (FNR)</span>
                <span className="font-bold text-amber-400 font-mono text-sm">{port.rackId}</span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Switch (S-Number)</span>
                <span className="font-bold text-sky-400 font-mono text-sm">{port.switchId}</span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Stack Unit / Member</span>
                <span className="font-bold text-slate-200 font-mono">Unit {port.switchUnit}</span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Slot / Port Number</span>
                <span className="font-bold text-slate-200 font-mono">
                  Slot {port.moduleSlot} • Port #{port.portNumber}
                </span>
              </div>
            </div>

            <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase">Associated Switch Hostname</span>
              <code className="text-slate-200 font-mono text-[11px] break-all">{port.deviceName}</code>
            </div>
          </div>

          {/* Verification / CLI Diagnostic Commands */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Switch CLI Verification Commands</span>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-slate-900 rounded-lg border border-slate-800 font-mono text-[11px]">
              <span className="text-emerald-400">{cliStatusCommand}</span>
              <button
                onClick={() => copyToClipboard(cliStatusCommand, 'status')}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                title="Copy Command"
              >
                {copiedCmd === 'status' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center justify-between p-2 bg-slate-900 rounded-lg border border-slate-800 font-mono text-[11px]">
              <span className="text-emerald-400">{cliConfigCommand}</span>
              <button
                onClick={() => copyToClipboard(cliConfigCommand, 'config')}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                title="Copy Command"
              >
                {copiedCmd === 'config' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Remediation Checklist if Missing */}
          {port.isMissing && (
            <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-xl text-xs text-amber-200/90 space-y-1">
              <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                <Cable className="w-3.5 h-3.5 text-amber-400" />
                <span>Physical Audit Checklist for Port #{port.portNumber}:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px] pl-1">
                <li>Inspect Rack {port.rackId}, Switch {port.switchId} front panel port {port.portNumber}.</li>
                <li>Check whether a patch cord is physically plugged into this RJ45/SFP port.</li>
                <li>Verify if port is intentionally vacant for future rack expansion.</li>
                <li>Check if the device connected is powered off or port is in admin shutdown.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-800/90 px-5 py-3 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
