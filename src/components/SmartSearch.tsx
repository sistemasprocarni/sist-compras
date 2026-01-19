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

  // Update internal state if displayValue changes from parent
  useEffect(() => {
    if (displayValue) {
      setQuery(displayValue);
      // Create a placeholder item for display if displayValue is just a string
      setSelectedItem({ id: 'initial-display', name: displayValue });
    } else {
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
    }, 300) as unknown as number; // Debounce for 300ms

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
    setOpen(true); // Ensure popover is open when typing
  };

  const handleSelect = (item: SearchResult) => {
    setSelectedItem(item);
    setQuery(item.name); // Set query to selected item's name
    onSelect(item);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          placeholder={placeholder}
          value={selectedItem ? selectedItem.name : query} // Display selected item name or current query
          onChange={handleInputChange}
          className="w-full"
        />
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          {/* CommandInput removed to avoid redundant input field */}
          <CommandList>
            <CommandEmpty>No se encontraron resultados.</CommandEmpty>
            <CommandGroup>
              {results.map((item) => (
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SmartSearch;