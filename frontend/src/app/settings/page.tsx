
'use client';

import React, { useState } from 'react';
import { Settings, RefreshCw, Server, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
    const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');

    const handleNetworkScan = () => {
        setScanStatus('scanning');
        // Mocking a network scan trigger - in reality this would hit an API endpoint like /api/system/scan
        setTimeout(() => {
            setScanStatus('success');
            setTimeout(() => setScanStatus('idle'), 3000);
        }, 2000);
    };

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-slate-800 rounded-xl text-slate-400">
                        <Settings size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">System Settings</h1>
                        <p className="text-slate-400 text-sm">Configure FactoryOS environment and services.</p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Network & Discovery */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Server size={20} className="text-blue-500" /> Network Discovery
                    </h3>
                    <p className="text-slate-400 text-sm mb-6">
                        Manually trigger a network scan to find new Bambu Lab printers on the local subnet (192.168.x.x).
                    </p>

                    <button
                        onClick={handleNetworkScan}
                        disabled={scanStatus === 'scanning'}
                        className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2
                            ${scanStatus === 'scanning' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 active:scale-95'}
                        `}
                    >
                        {scanStatus === 'scanning' && <RefreshCw className="animate-spin" />}
                        {scanStatus === 'success' && <CheckCircle2 />}
                        {scanStatus === 'idle' && <RefreshCw />}

                        {scanStatus === 'scanning' ? 'Scanning Subnet...' :
                            scanStatus === 'success' ? 'Scan Complete' : 'Start Discovery Scan'}
                    </button>

                    {scanStatus === 'success' && (
                        <p className="text-xs text-green-400 text-center mt-3 animate-in fade-in">
                            Discovery completed. Check "Fleet" for new devices.
                        </p>
                    )}
                </div>

                {/* Database Management */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 opacity-75">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Database size={20} className="text-amber-500" /> Database
                        </h3>
                        <span className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 font-mono">
                            SQLite
                        </span>
                    </div>
                    <p className="text-slate-400 text-sm mb-6">
                        System data is stored in <code className="bg-slate-950 px-1 py-0.5 rounded text-slate-300">factory.db</code>.
                        Resetting will clear all order history and printer configurations.
                    </p>

                    <button
                        disabled
                        className="w-full py-3 rounded-xl font-bold bg-slate-800 text-slate-500 cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <AlertTriangle size={18} />
                        Reset Database (Disabled)
                    </button>
                </div>
            </div>

            {/* Version Info */}
            <div className="text-center pt-10">
                <p className="text-slate-600 text-xs font-mono">
                    FactoryOS v1.0.0-beta &bull; Next.js 14 &bull; Python FastAPI
                </p>
            </div>
        </div>
    );
}
