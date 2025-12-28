
import React from 'react';
import { Plus } from 'lucide-react';

interface AddPrinterCardProps {
    onClick: () => void;
}

export const AddPrinterCard: React.FC<AddPrinterCardProps> = ({ onClick }) => {
    return (
        <div
            onClick={onClick}
            className="group relative flex flex-col items-center justify-center p-6 h-full min-h-[220px] rounded-2xl border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-900/20 hover:bg-slate-900/50 cursor-pointer transition-all duration-300"
        >
            <div className="p-4 rounded-full bg-slate-800 group-hover:bg-blue-600 transition-colors shadow-lg group-hover:shadow-blue-500/30">
                <Plus className="text-slate-400 group-hover:text-white transition-colors" size={32} />
            </div>
            <h3 className="mt-4 text-slate-400 group-hover:text-white font-bold text-lg transition-colors">Add Device</h3>
            <p className="text-xs text-slate-600 group-hover:text-slate-400 mt-1">Connect new hardware</p>
        </div>
    );
};
