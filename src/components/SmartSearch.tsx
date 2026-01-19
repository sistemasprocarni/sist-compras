import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  name: string;
  [key: string]: any; // Allow other properties
}

interface SmartSearchProps {
  placeholder: string;
  onSelect: (item: SearchResult) => void;
  fetchFunction: (query: string, supplierId?: string) => Promise<SearchResult[]>; // Updated to accept supplierId
  displayValue?: string; // Optional prop to control the displayed value
  supplierId?: string; // New optional prop for filtering by supplier
  disabled?: boolean; // New optional prop to disable the search
}

const SmartSearch: React.FC<SmartSearchProps> = ({ placeholder, onSelect, fetchFunction, displayValue, supplierId, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);

  // Update internal state if displayValue changes from parent
  useEffect(() => {
    if (displayValue) {
      setQuery(displayValue);
      setSelectedItem({ id: '', name: displayValue }); // Placeholder item for display
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
      // Pass supplierId to the fetchFunction if it exists
      const data = await fetchFunction(searchQuery, supplierId);
      setResults(data);
    } catch (error) {
      console.error('Error fetching search results:', error);
      setResults([]);
    }
  }, [fetchFunction, supplierId]); // Add supplierId to dependencies

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

  const handleSelect = (item: SearchResult) => {
    setSelectedItem(item);
    setQuery(item.name);
    onSelect(item);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled} // Disable the button
        >
          {selectedItem ? selectedItem.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
            disabled={disabled} // Disable the input
          />
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