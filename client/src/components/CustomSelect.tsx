import React, { useState, useRef, useEffect } from 'react';
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

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '-- Select --',
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedOption = options.find((opt) => opt.value === value);

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
  };

  const openDropdown = () => {
    updateCoords();
    setIsOpen(true);
  };

  const dropdown = isOpen && coords && (
    <div
      className="custom-select-dropdown"
      ref={dropdownRef}
      style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width, zIndex: 2000 }}
    >
      <div
        className={`custom-select-option ${value === '' ? 'is-selected' : ''}`}
        onClick={() => handleSelect('')}
      >
        {placeholder}
      </div>
      {options.map((opt) => (
        <div
          key={opt.value}
          className={`custom-select-option ${value === opt.value ? 'is-selected' : ''}`}
          onClick={() => handleSelect(opt.value)}
        >
          {opt.label}
        </div>
      ))}
    </div>
  );

  return (
    <div className={`custom-select-container ${isOpen ? 'is-open' : ''}`} ref={containerRef} id={id}>
      <div className="custom-select-trigger" onClick={() => (isOpen ? setIsOpen(false) : openDropdown())}>
        <span className={selectedOption ? 'selected-value' : 'placeholder-value'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <button
          type="button"
          className="custom-select-arrow-btn"
          aria-label="Toggle options"
          onClick={(e) => {
            e.stopPropagation();
            if (isOpen) setIsOpen(false);
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
