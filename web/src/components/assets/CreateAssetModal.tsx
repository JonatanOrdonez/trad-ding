"use client";

import { useState, useRef, useEffect } from "react";
import type { AssetType, CreateAssetRequest } from "@/types/asset";

interface CreateAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAssetRequest) => Promise<void>;
}

export function CreateAssetModal({ isOpen, onClose, onSubmit }: CreateAssetModalProps) {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [yfinanceSymbol, setYfinanceSymbol] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("stock");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Focus first field when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setName("");
      setSymbol("");
      setYfinanceSymbol("");
      setAssetType("stock");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit() {
    setError("");
    if (!name.trim() || !symbol.trim() || !yfinanceSymbol.trim()) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        yfinance_symbol: yfinanceSymbol.trim(),
        asset_type: assetType,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error creating asset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 sm:p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 id="modal-title" className="text-base font-semibold">Add asset</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="cursor-pointer flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div>
            <label htmlFor="f-name" className="text-sm font-medium text-gray-300 block mb-1.5">Name</label>
            <input
              ref={nameRef}
              id="f-name"
              type="text"
              placeholder="e.g. Apple Inc."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-150"
            />
          </div>
          <div>
            <label htmlFor="f-symbol" className="text-sm font-medium text-gray-300 block mb-1.5">Symbol</label>
            <input
              id="f-symbol"
              type="text"
              placeholder="e.g. AAPL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              autoComplete="off"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 uppercase focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-150"
            />
          </div>
          <div>
            <label htmlFor="f-yfinance" className="text-sm font-medium text-gray-300 block mb-1.5">Yahoo Finance symbol</label>
            <input
              id="f-yfinance"
              type="text"
              placeholder="e.g. AAPL (or BTC-USD for crypto)"
              value={yfinanceSymbol}
              onChange={(e) => setYfinanceSymbol(e.target.value)}
              autoComplete="off"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-150"
            />
            <p className="text-xs text-gray-500 mt-1.5">Will be validated against Yahoo Finance.</p>
          </div>
          <div>
            <label htmlFor="f-type" className="text-sm font-medium text-gray-300 block mb-1.5">Type</label>
            <select
              id="f-type"
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as AssetType)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-150 cursor-pointer"
            >
              <option value="stock">Stock</option>
              <option value="crypto">Crypto</option>
              <option value="etf">ETF</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div role="alert" className="flex items-center gap-1.5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer flex-1 min-h-[44px] bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-sm font-medium py-2.5 rounded-xl transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="cursor-pointer flex-1 min-h-[44px] bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-sm font-medium py-2.5 rounded-xl transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Validating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
