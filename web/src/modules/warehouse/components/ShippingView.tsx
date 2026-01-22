/**
 * Shipping View Component
 * Shipping management interface for warehouse module
 */

'use client';

export function ShippingView() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Shipping Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage outbound shipments and logistics
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-gray-600 dark:text-gray-400">
          Shipping management interface will be implemented here.
          This component is lazy loaded as part of the warehouse module.
        </p>
      </div>
    </div>
  );
}