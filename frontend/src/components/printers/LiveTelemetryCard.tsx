
import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cnUtils(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface LiveTelemetryCardProps {
    label: string;
    value: string | number | undefined;
    unit: string;
    icon: LucideIcon;
    color: 'orange' | 'blue' | 'emerald' | 'cyan' | 'purple';
}

export function LiveTelemetryCard({ label, value, unit, icon: Icon, color }: LiveTelemetryCardProps) {

    const colorStyles = {
        orange: "text-orange-500 bg-orange-500/10 border-orange-500/20",
        blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
        emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
        cyan: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
        purple: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    };

    const style = colorStyles[color] || colorStyles.blue;

    return (
        <div className={cnUtils("p-4 rounded-xl border flex flex-col justify-between transition-all hover:scale-[1.02]", style)}>
            <div className="flex items-center gap-2 mb-2">
                <Icon size={16} className="opacity-80" />
                <span className="text-[10px] uppercase font-bold tracking-widest opacity-70">{label}</span>
            </div>

            <div className="text-2xl font-black tracking-tight flex items-baseline">
                {value ?? '--'}
                <span className="text-sm font-medium opacity-60 ml-1">{unit}</span>
            </div>
        </div>
    );
}
