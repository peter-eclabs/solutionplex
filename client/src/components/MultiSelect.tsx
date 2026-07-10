import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  selectedValues: string[];
  onChange: (values: string[]) => void;
  options: Option[];
  placeholder?: string;
  emptyText?: string;
  id?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  selectedValues,
  onChange,
  options,
  placeholder = 'Search to add…',
  emptyText = 'No options available',
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedOptions = useMemo(
    () => selectedValues
      .map((val) => options.find((opt) => opt.value === val))
      .filter((opt): opt is Option => opt !== undefined),
    [selectedValues, options],
  );

  const availableOptions = useMemo(
    () => options
      .filter((opt) => !selectedValues.includes(opt.value))
      .filter((opt) => opt.label.toLowerCase().includes(query.trim().toLowerCase())),
    [options, selectedValues, query],
  );

  const updateCoords = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  };

  useEffect(() => {
    if (isOpen) updateCoords();
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setQuery('');
      }
    };
    const handleReposition = () => {
      if (isOpen) updateCoords();
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen]);

  const handleAdd = (value: string) => {
    onChange([...selectedValues, value]);
    setQuery('');
    inputRef.current?.focus();
  };

  const handleRemove = (value: string) => {
    onChange(selectedValues.filter((item) => item !== value));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && query === '' && selectedValues.length > 0) {
      handleRemove(selectedValues[selectedValues.length - 1]);
    }
  };

  const openDropdown = () => {
    updateCoords();
    setIsOpen(true);
    inputRef.current?.focus();
  };

  const dropdown = isOpen && coords && (
    <div
      className="custom-select-dropdown multi-select-portal"
      ref={dropdownRef}
      style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width, zIndex: 2000 }}
    >
      {availableOptions.length === 0 ? (
        <div className="multi-select-empty">
          {query.trim() !== '' ? 'No matches found' : emptyText}
        </div>
      ) : (
        availableOptions.map((opt) => (
          <div
            key={opt.value}
            className="custom-select-option"
            onClick={() => handleAdd(opt.value)}
          >
            {opt.label}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div
      className={`multi-select-container ${isOpen ? 'is-open' : ''}`}
      ref={containerRef}
      id={id}
    >
      <div className="multi-select-trigger" onClick={openDropdown}>
        <input
          ref={inputRef}
          type="text"
          className="multi-select-input"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="custom-select-arrow-btn"
          aria-label="Toggle options"
          onClick={(e) => {
            e.stopPropagation();
            if (isOpen) {
              setIsOpen(false);
              setQuery('');
            } else {
              openDropdown();
            }
          }}
        >
          <span className="custom-select-arrow"></span>
        </button>
      </div>

      {selectedOptions.length > 0 && (
        <div className="multi-select-pills">
          {selectedOptions.map((opt) => (
            <span key={opt.value} className="multi-select-pill">
              {opt.label}
              <button
                type="button"
                className="multi-select-pill-remove"
                onClick={() => handleRemove(opt.value)}
                aria-label={`Remove ${opt.label}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {createPortal(dropdown, document.body)}
    </div>
  );
};
