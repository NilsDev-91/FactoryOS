
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Upload, FileText, CheckCircle2, X, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function CreateProductPage() {
    const router = useRouter();

    // Form State
    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [description, setDescription] = useState('');
    const [material, setMaterial] = useState('PLA');
    const [colorHex, setColorHex] = useState('#ffffff');

    // File State
    const [file, setFile] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);

    // Submission State
    const [status, setStatus] = useState<'idle' | 'uploading' | 'creating' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            setErrorMessage("Please select a 3MF print file.");
            setStatus('error');
            return;
        }

        try {
            // Step 1: Upload File
            setStatus('uploading');
            const formData = new FormData();
            formData.append('file', file);

            const uploadRes = await fetch('http://localhost:8000/api/products/upload', {
                method: 'POST',
                body: formData,
            });

            if (!uploadRes.ok) throw new Error('File upload failed');
            const uploadData = await uploadRes.json();
            const filePath = uploadData.file_path; // Assuming backend returns { "file_path": "..." }

            // Step 2: Create Product
            setStatus('creating');
            const productPayload = {
                name,
                sku,
                description,
                required_filament_type: material,
                required_filament_color: colorHex, // e.g. "#FF0000"
                file_path_3mf: filePath
            };

            const createRes = await fetch('http://localhost:8000/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productPayload),
            });

            if (!createRes.ok) throw new Error('Failed to create product definition');

            setStatus('success');

            // Redirect after delay
            setTimeout(() => {
                router.push('/products');
            }, 1500);

        } catch (error: any) {
            setStatus('error');
            setErrorMessage(error.message || 'An unknown error occurred');
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <Link href="/products" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium mb-4">
                <ArrowLeft size={16} /> Back to Catalog
            </Link>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500">
                        <Package size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Create New Product</h1>
                        <p className="text-slate-400 text-sm">Define SKU requirements and upload print data</p>
                    </div>
                </div>

                {status === 'success' ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-green-500/30">
                            <CheckCircle2 className="text-white" size={32} />
                        </div>
                        <h3 className="text-2xl font-bold text-white">Product Created!</h3>
                        <p className="text-slate-400 mt-2">Redirecting to catalog...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* SKU & Name */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs uppercase font-bold text-slate-500 tracking-wider">SKU</label>
                                <input
                                    required
                                    placeholder="e.g. VASE-V2-RED"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white font-mono focus:border-blue-500 focus:outline-none transition-colors"
                                    value={sku}
                                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs uppercase font-bold text-slate-500 tracking-wider">Product Name</label>
                                <input
                                    required
                                    placeholder="e.g. Geometric Vase 2.0"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none transition-colors"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-slate-500 tracking-wider">Description</label>
                            <textarea
                                placeholder="Optional details..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white min-h-[80px] focus:border-blue-500 focus:outline-none transition-colors"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        {/* Material Requirements */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs uppercase font-bold text-slate-500 tracking-wider">Material</label>
                                <select
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none transition-colors appearance-none"
                                    value={material}
                                    onChange={(e) => setMaterial(e.target.value)}
                                >
                                    <option value="PLA">PLA</option>
                                    <option value="PETG">PETG</option>
                                    <option value="ABS">ABS</option>
                                    <option value="ASA">ASA</option>
                                    <option value="TPU">TPU</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs uppercase font-bold text-slate-500 tracking-wider">Color</label>
                                <div className="flex gap-3">
                                    <div className="relative w-12 h-[46px] rounded-lg overflow-hidden border border-slate-800 shrink-0">
                                        <input
                                            type="color"
                                            className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                                            value={colorHex}
                                            onChange={(e) => setColorHex(e.target.value)}
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white font-mono focus:border-blue-500 focus:outline-none transition-colors uppercase"
                                        value={colorHex}
                                        onChange={(e) => setColorHex(e.target.value)}
                                        maxLength={7}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* File Upload */}
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-slate-500 tracking-wider">Print File (.3mf)</label>
                            <div
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-xl p-8 transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer relative group
                                    ${dragActive ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-900'}
                                    ${file ? 'border-green-500/50 bg-green-500/5' : ''}
                                `}
                            >
                                <input
                                    type="file"
                                    accept=".3mf,.gcode"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={handleFileSelect}
                                />

                                {file ? (
                                    <>
                                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mb-3 shadow-lg shadow-green-500/20">
                                            <FileText className="text-white" size={24} />
                                        </div>
                                        <p className="text-green-400 font-bold text-lg">{file.name}</p>
                                        <p className="text-slate-500 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                        <p className="text-xs text-slate-600 mt-4 uppercase font-bold tracking-widest">Click to Change</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                            <Upload className="text-slate-400 group-hover:text-white" size={24} />
                                        </div>
                                        <p className="text-slate-300 font-medium">Drag & Drop or Click to Upload</p>
                                        <p className="text-slate-500 text-sm mt-1">Supports .3mf and .gcode files</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Error Message */}
                        {status === 'error' && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
                                <AlertTriangle size={20} />
                                <span className="text-sm font-medium">{errorMessage}</span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <div className="pt-4 flex gap-4">
                            <Link href="/products" className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={status === 'uploading' || status === 'creating'}
                                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl py-3 font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {status === 'uploading' && <Loader2 className="animate-spin" />}
                                {status === 'creating' && <Loader2 className="animate-spin" />}
                                {status === 'idle' && 'Create Product'}
                                {status === 'uploading' && 'Uploading File...'}
                                {status === 'creating' && 'Saving Definition...'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
