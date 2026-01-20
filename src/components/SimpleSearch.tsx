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
  const [showResults, setShowResults] = useState(false);
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
      setShowResults(false);
      return;
    }
    try {
      const data = await fetchFunction(searchQuery);
      setResults(data);
      setShowResults(data.length > 0);
    } catch (error) {
      console.error('Error fetching search results:', error);
      setResults([]);
      setShowResults(false);
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
    setShowResults(true);
  };

  const handleSelect = (item: SearchResult) => {
    setSelectedItem(item);
    setQuery(item.name);
    onSelect(item);
    setShowResults(false);
    inputRef.current?.focus();
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (
      inputRef.current && !inputRef.current.contains(e.target as Node) &&
      resultsRef.current && !resultsRef.current.contains(e.target as Node)
    ) {
      setShowResults(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredResults = results.filter(item =>
    item.name.toLowerCase().includes(query.toLowerCase()) ||
    (item.code && item.code.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setShowResults(true)}
          className="w-full appearance-none bg-background pl-8 shadow-none"
        />
      </div>
      {showResults && (
        <div
          ref={resultsRef}
          className="absolute z-10 w-full mt-1 bg-background border border-input rounded-md shadow-lg"
        >
          <div className="p-1">
            {query.length > 0 && filteredResults.length === 0 ? (
              <div className="px-4 py-2 text-sm text-muted-foreground">
                No se encontraron resultados para "{query}".
              </div>
            ) : query.length === 0 && results.length === 0 ? (
              <div className="px-4 py-2 text-sm text-muted-foreground">
                Empieza a escribir para buscar.
              </div>
            ) : (
              <div className="max-h-60 overflow-auto">
                {filteredResults.map((item) => (
                  <div
                    key={item.id}
                    className="px-4 py-2 text-sm cursor-pointer hover:bg-accent rounded-sm"
                    onClick={() => handleSelect(item)}
                  >
                    {item.name} {item.code && <span className="text-muted-foreground">({item.code})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleSearch;