import React from 'react';
import { TooltipProps } from 'recharts';
import { Card } from '@/components/ui/card';

interface ChartTooltipContentProps extends TooltipProps<number, string> {
  nameKey: string;
}

const ChartTooltipContent: React.FC<ChartTooltipContentProps> = ({ active, payload, nameKey }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <Card className="p-2 text-sm shadow-lg">
        <p className="font-bold">{data[nameKey]}</p>
        <p>Cantidad: {data.count}</p>
      </Card>
    );
  }
  return null;
};

export default ChartTooltipContent;