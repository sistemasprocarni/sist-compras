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
  const inputRef = useRef<HTMLInputElement>(null); // Ref for the input element

  // Update internal state if displayValue changes from parent
  useEffect(() => {
    if (displayValue && displayValue !== query) { // Only update if different to avoid loop
      setQuery(displayValue);
      setSelectedItem({ id: 'initial-display', name: displayValue });
    } else if (!displayValue && query) { // Clear if displayValue becomes empty
      setQuery('');
      setSelectedItem(null);
    }
  }, [displayValue]); // Depend on displayValue

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
    // If an item was previously selected and the user starts typing, clear the selection
    if (selectedItem && selectedItem.name !== newValue) {
      setSelectedItem(null);
      onSelect(null); // Notify parent that selection is cleared
    }
    // The popover will open via debouncedFetch if results are found
  };

  const handleSelect = (item: SearchResult) => {
    setSelectedItem(item);
    setQuery(item.name); // Set query to selected item's name
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
        {/* This div acts as the trigger, but the Input is separate and always editable */}
        <div className="relative w-full">
          <Input
            ref={inputRef}
            placeholder={placeholder}
            value={query} // This is the input the user types into
            onChange={handleInputChange}
            onFocus={() => setOpen(true)} // Open popover when input is focused
            onBlur={() => {
              // Close popover after a short delay to allow click on CommandItem
              setTimeout(() => setOpen(false), 150);
            }}
            className="w-full"
          />
          {/* Visually align the popover trigger with the input */}
          <span className="absolute inset-0 cursor-text" aria-hidden="true" />
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