/**
 * Employee Directory Component
 * Comprehensive employee listing and management interface
 */

import React, { useState, useMemo } from 'react';
import { useEmployees } from '../hooks/useEmployees';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmployeeFilters, EmployeeSortOptions } from '@/types/employee';

export function EmployeeDirectory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOptions, setSortOptions] = useState<EmployeeSortOptions>({
    field: 'lastName',
    direction: 'asc',
  });

  const {
    employees,
    connection,
    departments,
    loading,
    error,
    setFilters,
    setSorting,
    setPage,
    searchEmployees,
    createEmployee,
    updateEmployee,
    terminateEmployee,
  } = useEmployees({
    query: {
      page: currentPage,
      limit: 20,
      sortBy: sortOptions.field as string,
      sortOrder: sortOptions.direction,
    },
    enableRealTimeUpdates: true,
  });

  // Apply filters when they change
  React.useEffect(() => {
    const filters: EmployeeFilters = {
      search: searchTerm || undefined,
      departments: selectedDepartment ? [selectedDepartment] : undefined,
      employmentStatuses: selectedStatus ? [selectedStatus as any] : undefined,
    };
    setFilters(filters);
  }, [searchTerm, selectedDepartment, selectedStatus, setFilters]);

  // Apply sorting when it changes
  React.useEffect(() => {
    setSorting(sortOptions);
  }, [sortOptions, setSorting]);

  // Apply pagination when it changes
  React.useEffect(() => {
    setPage(currentPage);
  }, [currentPage, setPage]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleSort = (field: keyof typeof sortOptions, direction: 'asc' | 'desc') => {
    setSortOptions({ field: field as any, direction });
    setCurrentPage(1);
  };

  const handleEmployeeAction = async (action: string, employeeId: string) => {
    try {
      switch (action) {
        case 'terminate':
          await terminateEmployee(employeeId);
          break;
        // Add more actions as needed
      }
    } catch (error) {
      console.error('Employee action failed:', error);
    }
  };

  if (loading && employees.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading employee directory...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-red-600">Error loading employees: {error.message}</div>
      </div>
    );
  }

  const totalPages = connection?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Employee Directory</h1>
        <Button onClick={() => {/* Handle create employee */}}>
          Add Employee
        </Button>
      </div>

      {/* Filters and Search */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Search</label>
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
              <option value="on_leave">On Leave</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Sort By</label>
            <select
              value={`${sortOptions.field}-${sortOptions.direction}`}
              onChange={(e) => {
                const [field, direction] = e.target.value.split('-');
                handleSort(field as any, direction as 'asc' | 'desc');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="lastName-asc">Last Name (A-Z)</option>
              <option value="lastName-desc">Last Name (Z-A)</option>
              <option value="firstName-asc">First Name (A-Z)</option>
              <option value="firstName-desc">First Name (Z-A)</option>
              <option value="hireDate-desc">Hire Date (Newest)</option>
              <option value="hireDate-asc">Hire Date (Oldest)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Employee List */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Employees ({connection?.total || 0})
          </h2>
          {loading && (
            <div className="text-sm text-gray-500">Updating...</div>
          )}
        </div>

        <div className="space-y-4">
          {employees.map((employee) => (
            <div key={employee.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-lg font-medium">
                    {employee.firstName[0]}{employee.lastName[0]}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold">
                    {employee.firstName} {employee.lastName}
                  </h3>
                  <p className="text-sm text-gray-600">{employee.position}</p>
                  <p className="text-sm text-gray-500">
                    {employee.department} • {employee.employeeNumber}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <Badge variant={employee.isActive ? 'default' : 'secondary'}>
                    {employee.employmentStatus}
                  </Badge>
                  <p className="text-sm text-gray-500 mt-1">
                    {employee.employmentType}
                  </p>
                </div>
                
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                  {employee.isActive && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEmployeeAction('terminate', employee.id)}
                    >
                      Terminate
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {employees.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-gray-500">No employees found matching your criteria.</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}