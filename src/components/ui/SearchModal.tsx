'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface HelpInfo {
  title: string;
  steps: string[];
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  title: string;
  description: string;
  placeholder: string;
  inputPrefix?: string;
  accentColor?: string;
  helpInfo?: HelpInfo;
}

export function SearchModal({
  isOpen,
  onClose,
  onSearch,
  title,
  description,
  placeholder,
  inputPrefix,
  accentColor = '#7c3aed',
  helpInfo,
}: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      onSearch(trimmed);
      onClose();
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="search-modal-header">
          <div className="search-modal-icon" style={{ background: accentColor }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <div className="search-modal-title-group">
            <h2 className="search-modal-title">{title}</h2>
            <p className="search-modal-description">{description}</p>
          </div>
          <button className="search-modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="search-modal-input-wrapper">
            {inputPrefix && (
              <span className="search-modal-input-prefix">{inputPrefix}</span>
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="search-modal-input"
            />
          </div>

          {/* Help Info */}
          {helpInfo && (
            <div className="search-modal-help" style={{ background: hexToRgba(accentColor, 0.08), borderColor: hexToRgba(accentColor, 0.18) }}>
              <div className="search-modal-help-icon" style={{ color: accentColor }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
              </div>
              <div className="search-modal-help-content">
                <p className="search-modal-help-title" style={{ color: accentColor }}>{helpInfo.title}</p>
                {helpInfo.steps.map((step, i) => (
                  <p key={i} className="search-modal-help-step">{step}</p>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="search-modal-actions">
            <button type="button" className="search-modal-btn-cancel" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
              Cancel
            </button>
            <button
              type="submit"
              className="search-modal-btn-search"
              style={{ background: accentColor }}
              disabled={!query.trim()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              Search Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
