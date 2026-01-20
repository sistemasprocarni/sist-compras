"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface SearchResult {
  id: string;
  name: string;
  code?: string;
  [key: string]: any;
}

interface SimpleSearchProps {
  placeholder: string;
  onSelect: (item: SearchResult | null) => void;
  fetchFunction: (query: string) => Promise<SearchResult[]>;
  displayValue?: string;
}

const SimpleSearch: React.FC<SimpleSearchProps> = ({ placeholder, onSelect, fetchFunction, displayValue }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const debounceTimeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Sincronizar el estado interno con displayValue
  useEffect(() => {
    if (displayValue !== query) {
      setQuery(displayValue || '');
      if (!displayValue || (selectedItem && selectedItem.name !== displayValue)) {
        setSelectedItem(null);
      }
    }
  }, [displayValue, query, selectedItem]);

  const debouncedFetch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim() === '') {
      setResults([]);
      return;
    }
    try {
      const data = await fetchFunction(searchQuery);
      setResults(data);
    } catch (error) {
      console.error('Error fetching search results:', error);
      setResults([]);
    }
  }, [fetchFunction]);

  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      debouncedFetch(query);
    }, 300) as unknown as number;

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [query, debouncedFetch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    if (selectedItem && selectedItem.name !== newValue) {
      setSelectedItem(null);
      onSelect(null);
    }
  };

  const handleSelect = (item: SearchResult) => {
    setSelectedItem(item);
    setQuery(item.name);
    onSelect(item);
    setIsFocused(false);
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    // Usamos setTimeout para permitir que el clic en los resultados se procese antes de cerrar
    setTimeout(() => {
      setIsFocused(false);
    }, 200);
  };

  const filteredResults = results.filter(item =>
    item.name.toLowerCase().includes(query.toLowerCase()) ||
    (item.code && item.code.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="relative w-full">
      <div className="relative w-full">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="w-full appearance-none bg-background pl-8 shadow-none"
        />
      </div>
      {isFocused && query.length > 0 && filteredResults.length > 0 && (
        <div
          ref={resultsRef}
          className="absolute z-10 w-full mt-1 bg-background border border-input rounded-md shadow-lg"
        >
          <div className="p-1">
            {filteredResults.map((item) => (
              <div
                key={item.id}
                className="flex items-center px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent"
                onClick={() => handleSelect(item)}
              >
                {item.name} {item.code && <span className="text-muted-foreground ml-1">({item.code})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleSearch;