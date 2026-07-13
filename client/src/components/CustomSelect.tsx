import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  id?: string;
}

/** Visible rows before the list scrolls; keep in sync with --dropdown-visible-items. */
const DROPDOWN_VISIBLE_ITEMS = 5;

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '-- Select --',
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, filter]);

  const showSearch = options.length > DROPDOWN_VISIBLE_ITEMS;

  const updateCoords = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      if (showSearch) {
        requestAnimationFrame(() => filterRef.current?.focus());
      }
    } else {
      setFilter('');
    }
  }, [isOpen, showSearch]);

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

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setFilter('');
  };

  const openDropdown = () => {
    updateCoords();
    setIsOpen(true);
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setFilter('');
  };

  const dropdown = isOpen && coords && (
    <div
      className={`custom-select-dropdown${showSearch ? ' custom-select-dropdown-with-search' : ''}`}
      ref={dropdownRef}
      style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width, zIndex: 2000 }}
    >
      {showSearch && (
        <input
          ref={filterRef}
          type="text"
          className="custom-select-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="Type to search…"
          aria-label="Filter options"
        />
      )}
      <div className={showSearch ? 'custom-select-options' : undefined}>
        <div
          className={`custom-select-option ${value === '' ? 'is-selected' : ''}`}
          onClick={() => handleSelect('')}
        >
          {placeholder}
        </div>
        {filteredOptions.length === 0 ? (
          <div className="custom-select-option is-disabled" style={{ cursor: 'default' }}>
            No matching options
          </div>
        ) : (
          filteredOptions.map((opt) => (
            <div
              key={opt.value}
              className={`custom-select-option ${value === opt.value ? 'is-selected' : ''}`}
              onClick={() => handleSelect(opt.value)}
            >
              {opt.label}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className={`custom-select-container ${isOpen ? 'is-open' : ''}`} ref={containerRef} id={id}>
      <div className="custom-select-trigger" onClick={() => (isOpen ? closeDropdown() : openDropdown())}>
        <span className={selectedOption ? 'selected-value' : 'placeholder-value'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <button
          type="button"
          className="custom-select-arrow-btn"
          aria-label="Toggle options"
          onClick={(e) => {
            e.stopPropagation();
            if (isOpen) closeDropdown();
            else openDropdown();
          }}
        >
          <span className="custom-select-arrow"></span>
        </button>
      </div>

      {createPortal(dropdown, document.body)}
    </div>
  );
};
