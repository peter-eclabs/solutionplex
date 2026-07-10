import React, { useState, useRef, useEffect, useMemo } from 'react';

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
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  return (
    <div
      className={`multi-select-container ${isOpen ? 'is-open' : ''}`}
      ref={containerRef}
      id={id}
    >
      <div className="multi-select-trigger" onClick={() => { setIsOpen(true); inputRef.current?.focus(); }}>
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
        <span className="custom-select-arrow"></span>
      </div>

      {isOpen && (
        <div className="custom-select-dropdown">
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
      )}

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
    </div>
  );
};
