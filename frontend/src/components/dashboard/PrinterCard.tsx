
import React, { useState } from 'react';
import { Settings, Clock, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { mutate } from 'swr';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Type Definitions matching Backend Models partially
export interface AmsSlot {
    ams_index: number;
    slot_index: number;
    tray_color?: string; // Hex, e.g. "FF0000"
    tray_type?: string;
    remaining_percent?: number;
}

export interface Printer {
    serial: string;
    name: string;
    current_status: string; // "IDLE", "PRINTING", etc.
    current_progress?: number;
    remaining_time?: number;
    current_temp_nozzle?: number;
    current_temp_bed?: number;
    ams_slots?: AmsSlot[];
}

export interface PrinterCardProps {
    printer: Printer;
    onSettingsClick?: (printer: Printer) => void;
}

/**
 * High-Density PrinterCard
 * Design: Dark Mode / Industrial / High Scalability (500+ units)
 */
export function PrinterCard({ printer, onSettingsClick }: PrinterCardProps) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDeleting(true);
        try {
            const res = await fetch(`http://localhost:8000/api/printers/${printer.serial}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed to delete');
            mutate('http://localhost:8000/api/printers');
        } catch (error) {
            alert('Failed to delete printer');
            setIsDeleting(false);
        }
    };
    // Standardize status
    const status = (printer.current_status || 'idle').toLowerCase();
    const progress = printer.current_progress || 0;
    const timeLeft = printer.remaining_time ? `${printer.remaining_time}m` : null;

    // Strict color mapping per requirements
    const statusConfig: Record<string, { border: string; text: string; bg: string; progress: string }> = {
        idle: {
            border: 'border-purple-500',
            text: 'text-purple-500',
            bg: 'bg-purple-500/20',
            progress: 'bg-purple-500',
        },
        printing: {
            border: 'border-yellow-500',
            text: 'text-yellow-500',
            bg: 'bg-yellow-500/20',
            progress: 'bg-yellow-500',
        },
        done: {
            border: 'border-green-500',
            text: 'text-green-500',
            bg: 'bg-green-500/20',
            progress: 'bg-green-500',
        },
        error: {
            border: 'border-red-500',
            text: 'text-red-500',
            bg: 'bg-red-500/20',
            progress: 'bg-red-500',
        }
    };

    const config = statusConfig[status] || statusConfig.idle;

    // Clean Alpha from Hex if present (e.g. FF0000FF -> #FF0000)
    const formatColor = (color: string | undefined) => {
        if (!color) return '#334155'; // Slate-700 fallback
        let hex = color.startsWith('#') ? color : `#${color}`;
        if (hex.length > 7) hex = hex.substring(0, 7);
        return hex;
    };

    return (
        <div className={cn(
            "group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition-all hover:border-slate-700 h-[120px]", // Increased height slighly for AMS dots
            "flex flex-col"
        )}>
            {/* Delete Confirmation Overlay */}
            {showDeleteConfirm && (
                <div className="absolute inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-center text-center p-4 animate-in fade-in duration-200">
                    <AlertTriangle className="text-red-500 mb-2" size={24} />
                    <p className="text-white font-bold text-sm mb-1">Delete {printer.name}?</p>
                    <p className="text-[10px] text-slate-500 mb-4">This action cannot be undone.</p>
                    <div className="flex gap-2 w-full">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}
                            className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center"
                        >
                            {isDeleting ? <Loader2 size={12} className="animate-spin" /> : 'Delete'}
                        </button>
                    </div>
                </div>
            )}

            {/* 4px Colored Strip on Left */}
            <div className={cn("absolute left-0 top-0 bottom-0 w-1 transition-all group-hover:w-1.5", config.progress)} />

            <div className="flex-1 p-4 pl-5 flex flex-col justify-between">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                            {/* Colored Dot */}
                            <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]", config.progress)} />
                            <h3 className="font-bold text-white truncate uppercase tracking-tight text-sm" title={printer.name}>
                                {printer.name}
                            </h3>
                        </div>

                        {/* AMS Slots Visual */}
                        <div className="flex gap-1 ml-4">
                            {printer.ams_slots && printer.ams_slots.length > 0 ? (
                                printer.ams_slots.map((slot, idx) => (
                                    <div
                                        key={idx}
                                        className="w-3 h-3 rounded-full border border-slate-700 shadow-sm"
                                        style={{ backgroundColor: formatColor(slot.tray_color) }}
                                        title={`${slot.tray_type} - ${slot.tray_color}`}
                                    />
                                ))
                            ) : (
                                <span className="text-[10px] text-slate-600">No AMS</span>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-1">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm(true);
                            }}
                            className="p-1.5 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all active:scale-95"
                            title="Delete Printer"
                        >
                            <Trash2 size={16} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onSettingsClick?.(printer);
                            }}
                            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all active:scale-95"
                        >
                            <Settings size={16} />
                        </button>
                    </div>
                </div>

                {/* Footer (Progress & Time) */}
                <div className="space-y-1.5 mt-2">
                    <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-widest leading-none">
                        <span className={config.text}>{progress}%</span>
                        {status === 'printing' && timeLeft && (
                            <span className="text-slate-500 flex items-center gap-1 font-mono">
                                <Clock size={10} /> {timeLeft} left
                            </span>
                        )}
                        {status !== 'printing' && (
                            <span className={cn("px-1.5 py-0.5 rounded-[4px] text-[8px]", config.bg, config.text)}>
                                {status.toUpperCase()}
                            </span>
                        )}
                    </div>

                    {/* Highly Visible Progress Bar */}
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-950/50">
                        <div
                            className={cn("h-full transition-all duration-1000 shadow-[0_0_10px_rgba(0,0,0,0.3)]", config.progress)}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
