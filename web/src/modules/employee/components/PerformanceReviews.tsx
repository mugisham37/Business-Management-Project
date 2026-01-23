/**
 * Performance Reviews Component
 * Employee performance review management
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function PerformanceReviews() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Performance Reviews</h1>
        <Button>Create Review</Button>
      </div>

      <Card className="p-6">
        <div className="text-center py-8 text-gray-500">
          <p>Performance Reviews component is a placeholder.</p>
          <p>Full implementation will include review creation, goal tracking, and performance analytics.</p>
        </div>
      </Card>
    </div>
  );
}