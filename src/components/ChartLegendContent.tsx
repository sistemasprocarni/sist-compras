import React from 'react';
import { LegendProps } from 'recharts';

interface ChartLegendContentProps extends LegendProps {
  nameKey: string;
}

const ChartLegendContent: React.FC<ChartLegendContentProps> = ({ payload, nameKey }) => {
  if (!payload) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm p-2 max-h-40 overflow-y-auto">
      {payload.map((entry, index) => (
        <div key={`item-${index}`} className="flex items-center space-x-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.payload[nameKey]}</span>
        </div>
      ))}
    </div>
  );
};

export default ChartLegendContent;