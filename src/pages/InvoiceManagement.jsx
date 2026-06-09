import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function AutomatedInvoices() {
  const { collectionId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [customerId, setCustomerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Generate custom invoice
  const generateCustomInvoice = async () => {
    if (!customerId.trim()) {
      setError('Please enter a Customer ID');
      return;
    }

    // Use default date range if not specified
    const defaultStartDate = startDate || '2024-01-01';
    const defaultEndDate = endDate || '2024-12-31';

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('https://asia-south1-dairy-69.cloudfunctions.net/sendCustomInvoiceHTTP', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionId: collectionId,
          customerId: customerId.trim(),
          startDate: defaultStartDate,
          endDate: defaultEndDate
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setResults(result);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger monthly invoices for all customers
  const triggerMonthlyInvoices = async () => {
    if (!confirm('Are you sure you want to trigger monthly invoices for ALL customers? This will send real WhatsApp messages.')) {
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('https://asia-south1-dairy-69.cloudfunctions.net/triggerMonthlyInvoicesHTTP', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setResults(result);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            📄 Invoice Management System
          </h1>
          <p className="text-gray-600 mb-3">
            Generate professional invoices with UPI QR codes and WhatsApp delivery for your customers.
          </p>
          {collectionId && (
            <p className="text-sm text-blue-600 mt-2">
              Active collection: <code className="bg-blue-50 px-2 py-1 rounded">{collectionId}</code>
            </p>
          )}
        </div>

        {/* Custom Invoice Generation */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            📄 Generate Custom Invoice
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Generate professional PDF invoice with UPI QR code for a specific customer and date range.
          </p>
            
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter Customer ID (required)"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              💡 If dates are not specified, the system will use default date range (2024-01-01 to 2024-12-31).
            </p>
              
            <button
              onClick={generateCustomInvoice}
              disabled={loading || !collectionId || !customerId.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:bg-gray-400"
            >
              {loading ? '🔄 Generating Invoice...' : '🚀 Generate & Send Invoice'}
            </button>
          </div>
        </div>

        {/* Monthly Automation Trigger */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            🗓️ Manual Monthly Trigger
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Manually trigger the monthly invoice automation for all customers. Use this for testing or if the automatic monthly schedule needs to be run manually.
          </p>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <div className="flex items-start">
              <span className="text-orange-600 mr-2">⚠️</span>
              <div className="text-sm text-orange-800">
                <p className="font-semibold mb-1">Warning: This will process ALL customers</p>
                <p>This action will generate and send invoices to all customers across all collections. Only use this when you're ready to send real WhatsApp messages.</p>
              </div>
            </div>
          </div>
          <button
            onClick={triggerMonthlyInvoices}
            disabled={loading}
            className="bg-orange-600 hover:bg-orange-700 text-white py-3 px-6 rounded-lg font-medium transition-colors disabled:bg-gray-400"
          >
            {loading ? '🔄 Processing All Customers...' : '⚡ Trigger Monthly Invoices'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <h3 className="text-lg font-semibold text-red-800 mb-2">❌ Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Success Results */}
        {results && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-green-800 mb-3">✅ Invoice Generated Successfully!</h3>
            
            {results.success && (
              <div className="space-y-3">
                <p className="text-green-700">
                  Invoice has been generated and sent via WhatsApp.
                </p>
                {results.invoiceData && (
                  <div className="bg-white rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-gray-700">Invoice ID:</p>
                        <p className="text-gray-600">{results.invoiceData.invoiceId}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Total Amount:</p>
                        <p className="text-gray-600">₹{results.invoiceData.totalAmount}</p>
                      </div>
                    </div>
                    {results.invoiceData.pdfUrl && (
                      <div className="mt-3">
                        <a 
                          href={results.invoiceData.pdfUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          📄 View PDF Invoice
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* System Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 System Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div>
                <p className="font-medium text-gray-700">Monthly Automation</p>
                <p className="text-gray-600">Runs automatically on the 1st of every month</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Invoice Features</p>
                <p className="text-gray-600">Professional PDF with UPI QR codes</p>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <p className="font-medium text-gray-700">Delivery Method</p>
                <p className="text-gray-600">WhatsApp with PDF attachment</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Status</p>
                <p className="text-green-600 font-medium">✅ Active & Ready</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
