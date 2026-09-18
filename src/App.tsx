import React from 'react';
import { StreamlitSwitchportView } from './components/StreamlitSwitchportView';

export default function App() {
  return (
    <div className="min-h-screen bg-[#0e1117] text-[#f0f2f6] flex flex-col font-sans selection:bg-[#ff4b4b] selection:text-white">
      {/* Main Container directly opening the Switchport Audit View */}
      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
        <StreamlitSwitchportView />
      </main>

      {/* Footer */}
      <footer className="bg-[#1e2129] border-t border-[#262730] py-3 px-4 text-center text-xs text-[#808495]">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>
            Switchport CLI & Port Security Audit Parser
          </span>
          <span className="font-mono text-[11px] text-[#808495]">
            Missing Port & Gap Analysis Engine
          </span>
        </div>
      </footer>
    </div>
  );
}
