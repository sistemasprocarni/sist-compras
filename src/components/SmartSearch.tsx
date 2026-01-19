"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  name: string;
  code?: string; // Assuming code might be searchable
  [key: string]: any; // Allow other properties
}

interface SmartSearchProps {
  placeholder: string;
  onSelect: (item: SearchResult | null) => void; // Allow null to indicate cleared selection
  fetchFunction: (query: string) => Promise<SearchResult[]>;
  displayValue?: string; // Optional prop to control the displayed value
}

const SmartSearch: React.FC<SmartSearchProps> = ({ placeholder, onSelect, fetchFunction, displayValue }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update internal state if displayValue changes from parent
  useEffect(() => {
    if (displayValue && displayValue !== query) {
      setQuery(displayValue);
      setSelectedItem({ id: 'initial-display', name: displayValue });
    } else if (!displayValue && query) {
      setQuery('');
      setSelectedItem(null);
    }
  }, [displayValue]);

  const debouncedFetch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim() === '') {
      setResults([]);
      return;
    }
    try {
      const data = await fetchFunction(searchQuery);
      setResults(data);
      setOpen(true); // Open popover if results are fetched
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
    setOpen(true); // Ensure popover is open when typing
  };

  const handleSelect = (item: SearchResult) => {
    setSelectedItem(item);
    setQuery(item.name);
    onSelect(item);
    setOpen(false);
    inputRef.current?.focus(); // Keep focus on the input after selection
  };

  // Filter results based on current query for display in CommandList
  const filteredResults = results.filter(item =>
    item.name.toLowerCase().includes(query.toLowerCase()) ||
    (item.code && item.code.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={query} // Bind value directly to query state
          onChange={handleInputChange}
          onFocus={() => setOpen(true)} // Open popover when input is focused
          onBlur={() => {
            // Close popover after a short delay to allow click on CommandItem
            setTimeout(() => setOpen(false), 150);
          }}
          className="w-full"
        />
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
                    {item.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SmartSearch;