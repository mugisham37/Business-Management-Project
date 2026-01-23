/**
 * Employee Profile Component
 * Detailed employee profile view and management
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface EmployeeProfileProps {
  employeeId: string;
}

export function EmployeeProfile({ employeeId }: EmployeeProfileProps) {
  // This is a placeholder component
  // Full implementation would use useEmployees hook and display detailed employee information
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Employee Profile</h1>
        <Button>Edit Profile</Button>
      </div>

      <Card className="p-6">
        <div className="text-center">
          <div className="h-24 w-24 bg-gray-300 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl font-medium">JD</span>
          </div>
          <h2 className="text-2xl font-bold">John Doe</h2>
          <p className="text-gray-600">Software Engineer</p>
          <Badge className="mt-2">Active</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
          <div className="space-y-2">
            <p><span className="font-medium">Employee ID:</span> EMP001</p>
            <p><span className="font-medium">Email:</span> john.doe@company.com</p>
            <p><span className="font-medium">Phone:</span> (555) 123-4567</p>
            <p><span className="font-medium">Department:</span> Engineering</p>
            <p><span className="font-medium">Hire Date:</span> January 15, 2023</p>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Employment Details</h3>
          <div className="space-y-2">
            <p><span className="font-medium">Employment Type:</span> Full-time</p>
            <p><span className="font-medium">Status:</span> Active</p>
            <p><span className="font-medium">Manager:</span> Jane Smith</p>
            <p><span className="font-medium">Base Salary:</span> $75,000</p>
            <p><span className="font-medium">Pay Frequency:</span> Bi-weekly</p>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="text-center py-8 text-gray-500">
          <p>Employee profile component is a placeholder.</p>
          <p>Full implementation will show detailed employee information, time tracking, performance reviews, and more.</p>
        </div>
      </Card>
    </div>
  );
}