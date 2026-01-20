"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  name: string;
  code?: string;
  [key: string]: any;
}

interface SmartSearchProps {
  placeholder: string;
  onSelect: (item: SearchResult | null) => void;
  fetchFunction: (query: string) => Promise<SearchResult[]>;
  displayValue?: string;
}

const SmartSearch: React.FC<SmartSearchProps> = ({ placeholder, onSelect, fetchFunction, displayValue }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setOpen(false);
      return;
    }
    try {
      const data = await fetchFunction(searchQuery);
      setResults(data);
      setOpen(data.length > 0);
    } catch (error) {
      console.error('Error fetching search results:', error);
      setResults([]);
      setOpen(false);
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
    setOpen(true);
  };

  const handleSelect = (item: SearchResult) => {
    setSelectedItem(item);
    setQuery(item.name);
    onSelect(item);
    setOpen(false);
    inputRef.current?.focus();
  };

  const filteredResults = results.filter(item =>
    item.name.toLowerCase().includes(query.toLowerCase()) ||
    (item.code && item.code.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="relative w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="search"
              placeholder={placeholder}
              value={query}
              onChange={handleInputChange}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              className="w-full appearance-none bg-background pl-8 shadow-none"
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandList>
              {query.length > 0 && filteredResults.length === 0 ? (
                <CommandEmpty>No se encontraron resultados para "{query}".</CommandEmpty>
              ) : query.length === 0 && results.length === 0 ? (
                <CommandEmpty>Empieza a escribir para buscar.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredResults.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.name}
                      onSelect={() => handleSelect(item)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedItem?.id === item.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {item.name} {item.code && `(${item.code})`}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default SmartSearch;