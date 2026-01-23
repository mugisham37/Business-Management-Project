/**
 * Employee Dashboard Component
 * Main dashboard for employee management overview
 */

import React from 'react';
import { useEmployees } from '../hooks/useEmployees';
import { useTimeTracking } from '../hooks/useTimeTracking';
import { useLiveData } from '@/hooks/useLiveData';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function EmployeeDashboard() {
  const { employees, loading, connection } = useEmployees({
    query: { limit: 10 },
    enableRealTimeUpdates: true,
  });

  const { timeEntries, currentTimeEntry } = useTimeTracking({
    enableRealTimeUpdates: true,
  });

  const { employee: liveEmployeeData } = useLiveData({
    employee: {},
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading employee dashboard...</div>
      </div>
    );
  }

  const totalEmployees = connection?.total || 0;
  const activeEmployees = employees.filter(emp => emp.isActive).length;
  const currentlyWorking = timeEntries.filter(entry => !entry.clockOutTime).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Employee Dashboard</h1>
        <Badge variant="outline">
          {totalEmployees} Total Employees
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Employees</p>
              <p className="text-2xl font-bold">{activeEmployees}</p>
            </div>
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
              <div className="h-4 w-4 bg-green-600 rounded-full"></div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Currently Working</p>
              <p className="text-2xl font-bold">{currentlyWorking}</p>
            </div>
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
              <div className="h-4 w-4 bg-blue-600 rounded-full"></div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Recent Activity</p>
              <p className="text-2xl font-bold">{liveEmployeeData.employeeActivity?.length || 0}</p>
            </div>
            <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
              <div className="h-4 w-4 bg-purple-600 rounded-full"></div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Employees */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Employees</h2>
        <div className="space-y-3">
          {employees.slice(0, 5).map((employee) => (
            <div key={employee.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {employee.firstName[0]}{employee.lastName[0]}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{employee.firstName} {employee.lastName}</p>
                  <p className="text-sm text-gray-600">{employee.position}</p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={employee.isActive ? 'default' : 'secondary'}>
                  {employee.employmentStatus}
                </Badge>
                <p className="text-sm text-gray-600 mt-1">{employee.department}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Live Activity Feed */}
      {liveEmployeeData.employeeActivity && liveEmployeeData.employeeActivity.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Live Activity</h2>
          <div className="space-y-2">
            {liveEmployeeData.employeeActivity.slice(0, 5).map((activity: any, index: number) => (
              <div key={index} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <p className="text-sm">{activity.message || activity.type}</p>
                <span className="text-xs text-gray-500">
                  {new Date(activity.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}