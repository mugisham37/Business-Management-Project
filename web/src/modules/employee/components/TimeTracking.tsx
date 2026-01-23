/**
 * Time Tracking Component
 * Employee time tracking and attendance management
 */

import React, { useState, useEffect } from 'react';
import { useTimeTracking } from '../hooks/useTimeTracking';
import { useEmployees } from '../hooks/useEmployees';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TimeEntry, EmployeeSchedule } from '@/types/employee';

export function TimeTracking() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    end: new Date(),
  });

  const { activeEmployees } = useEmployees();
  
  const {
    timeEntries,
    schedules,
    currentTimeEntry,
    todaySchedule,
    timeEntriesLoading,
    schedulesLoading,
    clockingLoading,
    clockIn,
    clockOut,
    approveTimeEntry,
    createSchedule,
    isCurrentlyWorking,
    getTotalHoursForPeriod,
    getOvertimeHours,
    getAttendanceRate,
    getCurrentStatus,
    getTimeAnalytics,
    setDateRange: setTimeTrackingDateRange,
  } = useTimeTracking({
    employeeId: selectedEmployeeId,
    enableRealTimeUpdates: true,
    autoRefresh: true,
  });

  // Update date range when it changes
  useEffect(() => {
    setTimeTrackingDateRange(dateRange.start, dateRange.end);
  }, [dateRange, setTimeTrackingDateRange]);

  const handleClockIn = async (employeeId: string) => {
    try {
      await clockIn({
        employeeId,
        notes: 'Clocked in via web interface',
      });
    } catch (error) {
      console.error('Clock in failed:', error);
    }
  };

  const handleClockOut = async (timeEntryId: string) => {
    try {
      await clockOut({
        timeEntryId,
        notes: 'Clocked out via web interface',
      });
    } catch (error) {
      console.error('Clock out failed:', error);
    }
  };

  const handleApproveTimeEntry = async (timeEntryId: string) => {
    try {
      await approveTimeEntry(timeEntryId);
    } catch (error) {
      console.error('Time entry approval failed:', error);
    }
  };

  const selectedEmployee = activeEmployees.find(emp => emp.id === selectedEmployeeId);
  const currentStatus = getCurrentStatus(selectedEmployeeId);
  const totalHours = getTotalHoursForPeriod(dateRange.start, dateRange.end, selectedEmployeeId);
  const overtimeHours = getOvertimeHours(dateRange.start, dateRange.end, selectedEmployeeId);
  const attendanceRate = getAttendanceRate(dateRange.start, dateRange.end, selectedEmployeeId);
  const analytics = getTimeAnalytics(dateRange.start, dateRange.end, selectedEmployeeId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Time Tracking</h1>
        <Button onClick={() => {/* Handle create schedule */}}>
          Create Schedule
        </Button>
      </div>

      {/* Employee Selection and Quick Actions */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Employee</label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Employees</option>
              {activeEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName} - {employee.position}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Date Range</label>
            <div className="flex space-x-2">
              <input
                type="date"
                value={dateRange.start.toISOString().split('T')[0]}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={dateRange.end.toISOString().split('T')[0]}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {selectedEmployeeId && (
            <div>
              <label className="block text-sm font-medium mb-2">Quick Actions</label>
              <div className="flex space-x-2">
                {currentStatus === 'clocked_out' ? (
                  <Button
                    onClick={() => handleClockIn(selectedEmployeeId)}
                    disabled={clockingLoading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Clock In
                  </Button>
                ) : currentStatus === 'clocked_in' ? (
                  <Button
                    onClick={() => currentTimeEntry && handleClockOut(currentTimeEntry.id)}
                    disabled={clockingLoading || !currentTimeEntry}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Clock Out
                  </Button>
                ) : (
                  <Badge variant="outline">{currentStatus.replace('_', ' ')}</Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Analytics Summary */}
      {selectedEmployeeId && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Total Hours</p>
              <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Overtime Hours</p>
              <p className="text-2xl font-bold text-orange-600">{overtimeHours.toFixed(1)}</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Attendance Rate</p>
              <p className="text-2xl font-bold text-green-600">{attendanceRate.toFixed(1)}%</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Avg Hours/Day</p>
              <p className="text-2xl font-bold">{analytics.averageHoursPerDay.toFixed(1)}</p>
            </div>
          </Card>
        </div>
      )}

      {/* Current Status */}
      {selectedEmployee && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            Current Status - {selectedEmployee.firstName} {selectedEmployee.lastName}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-2">Time Entry Status</h3>
              <div className="flex items-center space-x-2">
                <Badge variant={currentStatus === 'clocked_in' ? 'default' : 'secondary'}>
                  {currentStatus.replace('_', ' ').toUpperCase()}
                </Badge>
                {currentTimeEntry && (
                  <span className="text-sm text-gray-600">
                    Since {new Date(currentTimeEntry.clockInTime).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">Today's Schedule</h3>
              {todaySchedule ? (
                <div className="text-sm">
                  <p>{new Date(todaySchedule.startTime).toLocaleTimeString()} - {new Date(todaySchedule.endTime).toLocaleTimeString()}</p>
                  <p className="text-gray-600">{todaySchedule.department}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No schedule for today</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Time Entries */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Time Entries</h2>
          {timeEntriesLoading && (
            <div className="text-sm text-gray-500">Loading...</div>
          )}
        </div>

        <div className="space-y-4">
          {timeEntries.map((entry: TimeEntry) => (
            <div key={entry.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-4">
                <div>
                  <p className="font-medium">
                    {new Date(entry.clockInTime).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(entry.clockInTime).toLocaleTimeString()} - {' '}
                    {entry.clockOutTime ? new Date(entry.clockOutTime).toLocaleTimeString() : 'In Progress'}
                  </p>
                </div>
                <div>
                  <p className="text-sm">
                    <span className="font-medium">Total:</span> {entry.totalHours?.toFixed(1) || 0}h
                  </p>
                  {entry.overtimeHours && entry.overtimeHours > 0 && (
                    <p className="text-sm text-orange-600">
                      <span className="font-medium">Overtime:</span> {entry.overtimeHours.toFixed(1)}h
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <Badge variant={entry.isApproved ? 'default' : 'secondary'}>
                    {entry.isApproved ? 'Approved' : 'Pending'}
                  </Badge>
                  <p className="text-sm text-gray-500 mt-1">{entry.entryType}</p>
                </div>

                {!entry.isApproved && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleApproveTimeEntry(entry.id)}
                  >
                    Approve
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {timeEntries.length === 0 && !timeEntriesLoading && (
          <div className="text-center py-8">
            <p className="text-gray-500">No time entries found for the selected period.</p>
          </div>
        )}
      </Card>

      {/* Schedules */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Schedules</h2>
          {schedulesLoading && (
            <div className="text-sm text-gray-500">Loading...</div>
          )}
        </div>

        <div className="space-y-4">
          {schedules.map((schedule: EmployeeSchedule) => (
            <div key={schedule.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">
                  {new Date(schedule.scheduleDate).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-600">
                  {new Date(schedule.startTime).toLocaleTimeString()} - {new Date(schedule.endTime).toLocaleTimeString()}
                </p>
                <p className="text-sm text-gray-500">{schedule.department}</p>
              </div>

              <div className="text-right">
                <Badge variant={schedule.status === 'confirmed' ? 'default' : 'secondary'}>
                  {schedule.status}
                </Badge>
                <p className="text-sm text-gray-500 mt-1">
                  {schedule.totalHours?.toFixed(1) || 0}h scheduled
                </p>
              </div>
            </div>
          ))}
        </div>

        {schedules.length === 0 && !schedulesLoading && (
          <div className="text-center py-8">
            <p className="text-gray-500">No schedules found for the selected period.</p>
          </div>
        )}
      </Card>
    </div>
  );
}