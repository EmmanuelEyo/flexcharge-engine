/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useRef, useEffect } from "react";

interface Option {
  value: string | number;
  label: string;
}

interface SelectProps {
  value: string | number | undefined;
  onChange: (value: any) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  className = "",
  disabled = false,
  searchable = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (val: string | number) => {
    if (disabled) return;
    onChange(val);
    setIsOpen(false);
    setSearchTerm("");
  };

  const filteredOptions = searchable 
    ? options.filter((opt) => opt.label.toLowerCase().includes(searchTerm.toLowerCase())) 
    : options;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        <span className={selectedOption ? "text-slate-900" : "text-slate-400"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className={`material-symbols-outlined text-[18px] text-slate-400 select-none transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          keyboard_arrow_down
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg animate-in fade-in slide-in-from-top-1 duration-100">
          {searchable && (
            <div className="p-1.5 border-b border-slate-100 flex items-center gap-1.5 sticky top-0 bg-white z-10 mb-1">
              <span className="material-symbols-outlined text-[18px] text-slate-400">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                autoFocus
                className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white transition-all text-slate-900"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm("")} className="text-slate-400 hover:text-slate-600 outline-none">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
          )}
          {filteredOptions.length > 0 ? filteredOptions.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-slate-50 cursor-pointer ${
                  isSelected ? "bg-slate-50 text-indigo-600" : "text-slate-700"
                }`}
              >
                <span>{option.label}</span>
                {isSelected && (
                  <span className="material-symbols-outlined text-[16px] text-indigo-600">
                    check
                  </span>
                )}
              </button>
            );
          }) : (
            <div className="px-3 py-4 text-center text-sm text-slate-500">
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
