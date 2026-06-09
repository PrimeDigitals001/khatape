import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PencilIcon,
  TrashIcon,
  PlusIcon,
  CreditCardIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationIcon,
} from "@heroicons/react/outline";
import { useNavigate } from "react-router-dom";
import { adminAPI } from "../services/adminAPI";

export default function ManageCustomers() {
  const focusParams =
    window.history.state && window.history.state.usr
      ? window.history.state.usr
      : null;
  const navigate = useNavigate();



  const [customers, setCustomers] = useState([]);
  const [customerUnpaidAmounts, setCustomerUnpaidAmounts] = useState({}); // New state for unpaid amounts
  const [search, setSearch] = useState("");
  const [showRfidModal, setShowRfidModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [rfidNumber, setRfidNumber] = useState("");
  const [rfidInput, setRfidInput] = useState("");
  const [rfidError, setRfidError] = useState("");
  const [customerDetails, setCustomerDetails] = useState({
    name: "",
    phone: "",
  });

  // Record-payment modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [payCustomer, setPayCustomer] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNote, setPayNote] = useState("");
  const [paySaving, setPaySaving] = useState(false);

  // Assign-card (RFID) modal — for customers imported without a card
  const [showAssign, setShowAssign] = useState(false);
  const [assignCustomer, setAssignCustomer] = useState(null);
  const [assignRfid, setAssignRfid] = useState("");
  const [assignErr, setAssignErr] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);

  // Standing-order modal state (daily delivery round)
  const [showStandingModal, setShowStandingModal] = useState(false);
  const [standingCustomer, setStandingCustomer] = useState(null);
  const [standingList, setStandingList] = useState([]);
  const [standingItemId, setStandingItemId] = useState("");
  const [standingQty, setStandingQty] = useState("1");
  const [standingSaving, setStandingSaving] = useState(false);
  const [itemsForPicker, setItemsForPicker] = useState([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = sessionStorage.getItem("customersCurrentPage");
    const parsed = parseInt(saved, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  });
  const [pagination, setPagination] = useState({
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [rfidValidating, setRfidValidating] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  // RFID input ref for auto-focus
  const rfidInputRef = useRef(null);

  // Load customers on component mount and when search/page changes
  useEffect(() => {
    loadCustomers();
  }, [currentPage]);

  // Persist current page so back-navigation from invoice page restores it
  useEffect(() => {
    sessionStorage.setItem("customersCurrentPage", String(currentPage));
  }, [currentPage]);

  // Handle search with debounce
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (search !== "") {
        handleSearch();
      } else {
        loadCustomers();
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [search]);

  // Auto-focus RFID input when modal opens
  useEffect(() => {
    if (showRfidModal && rfidInputRef.current) {
      rfidInputRef.current.focus();
    }
  }, [showRfidModal]);

  // Load customers from API
  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await adminAPI.getCustomers(currentPage, 10, search);
      setCustomers(response.data.customers);
      setPagination(response.data.pagination);

      // Load unpaid amounts for all customers
      await loadCustomerUnpaidAmounts(response.data.customers);

      // Focus row when navigated from top search
      if (
        focusParams &&
        focusParams.focusType === "customer" &&
        focusParams.focusId
      ) {
        setTimeout(() => {
          const row = document.querySelector(
            `[data-customer-row="${focusParams.focusId}"]`
          );
          if (row) {
            row.scrollIntoView({ behavior: "smooth", block: "center" });
            row.classList.add("ring-2", "ring-red-400");
            setTimeout(
              () => row.classList.remove("ring-2", "ring-red-400"),
              1500
            );
          }
        }, 50);
      }
    } catch (error) {
      console.error("Failed to load customers:", error);
      setError("Failed to load customers. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Live khaata dues for all customers (purchases - payments), one cheap call.
  const loadCustomerUnpaidAmounts = async () => {
    try {
      const balances = await adminAPI.getTenantBalances();
      const unpaidAmounts = {};
      Object.entries(balances).forEach(([cid, b]) => {
        unpaidAmounts[cid] = b.due > 0 ? b.due : 0;
      });
      setCustomerUnpaidAmounts(unpaidAmounts);
    } catch (error) {
      console.error("Failed to load customer balances:", error);
    }
  };

  // Helper function to get unpaid amount for a customer
  const getCustomerUnpaidAmount = (customerId) => {
    return customerUnpaidAmounts[customerId] || 0;
  };

  // Helper function to check if customer has unpaid amount
  const hasUnpaidAmount = (customerId) => {
    return getCustomerUnpaidAmount(customerId) > 0;
  };

  // Handle search
  const handleSearch = async () => {
    try {
      setSearchLoading(true);
      setError(null);
      setCurrentPage(1);

      const response = await adminAPI.getCustomers(1, 10, search);
      setCustomers(response.data.customers);
      setPagination(response.data.pagination);

      // Load unpaid amounts for search results
      await loadCustomerUnpaidAmounts(response.data.customers);
    } catch (error) {
      console.error("Search failed:", error);
      setError("Search failed. Please try again.");
    } finally {
      setSearchLoading(false);
    }
  };

  const goToPage = (page) => {
    setCurrentPage(page);
  };

  // RFID validation
  const validateRfid = async (rfidValue) => {
    if (!rfidValue.trim()) {
      setRfidError("Please tap your RFID card");
      return false;
    }

    setRfidValidating(true);
    try {
      // Check if RFID already exists via API
      const response = await adminAPI.validateRfid(
        rfidValue.trim(),
        editingCustomer?.id
      );

      if (!response.data.isValid) {
        setRfidError(response.data.message || "RFID is already registered");
        return false;
      }

      setRfidError("");
      return true;
    } catch (error) {
      console.error("RFID validation failed:", error);
      setRfidError("Failed to validate RFID. Please try again.");
      return false;
    } finally {
      setRfidValidating(false);
    }
  };

  const handleRfidInput = (e) => {
    const value = e.target.value;
    setRfidInput(value);

    if (rfidError) {
      setRfidError("");
    }
  };

  const handleRfidSubmit = async (e) => {
    e.preventDefault();
    const trimmedRfid = rfidInput.trim();

    const isValid = await validateRfid(trimmedRfid);
    if (isValid) {
      setRfidNumber(trimmedRfid);
      setShowRfidModal(false);
      setShowDetailsModal(true);
    }
  };

  const openAddCustomer = () => {
    setEditingCustomer(null);
    setRfidNumber("");
    setRfidInput("");
    setRfidError("");
    setCustomerDetails({ name: "", phone: "" });
    setError(null);
    setShowRfidModal(true);
  };

  const openEditCustomer = (customer) => {
    setEditingCustomer(customer);
    setRfidNumber(customer.rfid);
    setCustomerDetails({ name: customer.name, phone: customer.phone });
    setRfidError("");
    setError(null);
    setShowDetailsModal(true);
  };

  const openDeleteConfirmation = (customer) => {
    setDeletingCustomer(customer);
    setShowDeleteModal(true);
    setError(null);
  };

  const closeAllModals = () => {
    setShowRfidModal(false);
    setShowDetailsModal(false);
    setShowDeleteModal(false);
    setEditingCustomer(null);
    setDeletingCustomer(null);
    setRfidNumber("");
    setRfidInput("");
    setRfidError("");
    setCustomerDetails({ name: "", phone: "" });
    setError(null);
    setRfidValidating(false);
  };

  // Handle save customer (create or update)
  const handleSaveCustomer = async () => {
    if (!customerDetails.name.trim() || !customerDetails.phone || !rfidNumber) {
      setError("Please fill in all required fields");
      return;
    }

    if (customerDetails.phone.length !== 10) {
      setError("Phone number must be exactly 10 digits");
      return;
    }

    setModalLoading(true);
    setError(null);

    try {
      let response;

      if (editingCustomer) {
        // Update existing customer
        response = await adminAPI.updateCustomer(editingCustomer.id, {
          name: customerDetails.name,
          phone: customerDetails.phone,
          rfid: rfidNumber,
        });
        setSuccessMessage("Customer updated successfully!");
      } else {
        // Create new customer
        response = await adminAPI.createCustomer({
          name: customerDetails.name,
          phone: customerDetails.phone,
          rfid: rfidNumber,
        });
        setSuccessMessage("Customer created successfully!");
      }

      // Reload customers
      await loadCustomers();
      closeAllModals();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Save customer failed:", error);
      setError(error.message || "Failed to save customer. Please try again.");
    } finally {
      setModalLoading(false);
    }
  };

  // Handle delete customer
  const confirmDeleteCustomer = async () => {
    if (!deletingCustomer) return;

    setDeleteLoading(true);
    setError(null);

    try {
      await adminAPI.deleteCustomer(deletingCustomer.id);
      setSuccessMessage("Customer deleted successfully!");

      // Reload customers
      await loadCustomers();
      closeAllModals();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Delete customer failed:", error);
      setError(error.message || "Failed to delete customer. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleInvoiceClick = (customer) => {
    navigate(`/admin/customers/${customer.id}/invoice`);
  };

  // ---- Assign RFID card to an imported (card-less) customer ----
  const openAssign = (customer) => {
    setAssignCustomer(customer);
    setAssignRfid("");
    setAssignErr("");
    setShowAssign(true);
  };
  const closeAssign = () => {
    setShowAssign(false);
    setAssignCustomer(null);
  };
  const submitAssign = async () => {
    const rfid = assignRfid.trim();
    if (!rfid) { setAssignErr("Tap the card"); return; }
    try {
      setAssignSaving(true);
      setAssignErr("");
      const check = await adminAPI.validateRfid(rfid, assignCustomer.id);
      if (!check.data.isValid) { setAssignErr(check.data.message); return; }
      await adminAPI.updateCustomer(assignCustomer.id, {
        name: assignCustomer.name,
        phone: assignCustomer.phone,
        rfid,
      });
      setSuccessMessage(`Card assigned to ${assignCustomer.name}`);
      closeAssign();
      await loadCustomers();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (e) {
      setAssignErr(e.message || "Failed to assign card");
    } finally {
      setAssignSaving(false);
    }
  };

  // ---- Standing orders (daily delivery round) ----
  const openStandingModal = async (customer) => {
    setStandingCustomer(customer);
    setStandingItemId("");
    setStandingQty("1");
    setError(null);
    setShowStandingModal(true);
    try {
      const [itemsRes, soRes] = await Promise.all([
        itemsForPicker.length ? Promise.resolve({ data: { items: itemsForPicker } }) : adminAPI.getItems(1, 1000),
        adminAPI.getCustomerStandingOrders(customer.id),
      ]);
      if (!itemsForPicker.length) setItemsForPicker(itemsRes.data.items);
      setStandingList(soRes.data.standingOrders);
    } catch (e) {
      setError(e.message || "Failed to load standing orders");
    }
  };

  const closeStandingModal = () => {
    setShowStandingModal(false);
    setStandingCustomer(null);
    setStandingList([]);
  };

  const addStandingOrder = async () => {
    const item = itemsForPicker.find((i) => i.id === standingItemId);
    if (!item) { setError("Pick an item"); return; }
    const qty = parseFloat(standingQty);
    if (!qty || qty <= 0) { setError("Enter a valid quantity"); return; }
    try {
      setStandingSaving(true);
      setError(null);
      await adminAPI.setStandingOrder({
        customerId: standingCustomer.id,
        itemId: item.id,
        itemName: item.name,
        quantity: qty,
        saleUnit: item.pricingMode === "loose" ? item.rateUnit : "piece",
      });
      const soRes = await adminAPI.getCustomerStandingOrders(standingCustomer.id);
      setStandingList(soRes.data.standingOrders);
      setStandingItemId("");
      setStandingQty("1");
    } catch (e) {
      setError(e.message || "Failed to save standing order");
    } finally {
      setStandingSaving(false);
    }
  };

  const removeStanding = async (id) => {
    try {
      await adminAPI.removeStandingOrder(id);
      setStandingList((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e.message || "Failed to remove");
    }
  };

  // ---- Record payment (khaata collection) ----
  const openPayModal = (customer) => {
    setPayCustomer(customer);
    setPayAmount("");
    setPayMethod("cash");
    setPayNote("");
    setError(null);
    setShowPayModal(true);
  };

  const closePayModal = () => {
    setShowPayModal(false);
    setPayCustomer(null);
  };

  const submitPayment = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      setError("Enter a valid payment amount");
      return;
    }
    try {
      setPaySaving(true);
      setError(null);
      await adminAPI.recordPayment({
        customerId: payCustomer.id,
        amount: amt,
        method: payMethod,
        note: payNote,
      });
      setSuccessMessage(`Payment of ₹${amt} recorded for ${payCustomer.name}`);
      closePayModal();
      await loadCustomerUnpaidAmounts();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (e) {
      setError(e.message || "Failed to record payment");
    } finally {
      setPaySaving(false);
    }
  };

  // Loading spinner component
  const LoadingSpinner = ({ size = "md" }) => {
    const sizeClasses = {
      sm: "h-4 w-4",
      md: "h-8 w-8",
      lg: "h-12 w-12",
    };

    return (
      <div className="flex items-center justify-center">
        <div
          className={`animate-spin rounded-full border-b-2 border-red-500 ${sizeClasses[size]}`}
        ></div>
      </div>
    );
  };

  return (
    <div className="h-full bg-slate-50 p-3 sm:p-6 flex flex-col overflow-hidden">
      {/* Success Message */}
      {successMessage && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-sm bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50">
          <span className="block text-sm">{successMessage}</span>
          <button
            onClick={() => setSuccessMessage("")}
            className="float-right ml-4 font-bold text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-sm bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50">
          <span className="block text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="float-right ml-4 font-bold text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Responsive Header Card */}
      <div className="bg-white shadow-sm rounded-xl mb-3 sm:mb-4 flex-shrink-0">
        {/* Mobile Compact Header */}
        <div className="block lg:hidden p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            {/* Left side: Search */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  disabled={loading}
                  className="w-full sm:w-64 rounded-lg border border-gray-300 px-3 py-2 pr-9 text-sm bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-slate-50"
                />
                <div className="absolute right-2.5 top-2.5">
                  {searchLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <svg
                      className="h-4 w-4 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {/* Right side: Total count and Add button */}
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Total:</span>
                  <span className="font-semibold text-black">
                    {loading ? "..." : pagination.totalItems}
                  </span>
                </div>
              </div>

              <button
                onClick={openAddCustomer}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                Add Customer
              </button>
            </div>
          </div>
        </div>

        {/* Desktop/Tablet Expanded Header */}
        <div className="hidden lg:block p-4">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
            {/* Left: Search with Label */}
            <div className="flex flex-col gap-1">
              <label htmlFor="search" className="text-sm font-medium text-black">
                Quick search a Customer
              </label>
              <div className="relative mt-1">
                <input
                  id="search"
                  type="text"
                  placeholder="Enter Name, Phone or RFID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  disabled={loading}
                  className="w-72 rounded-xl border border-gray-400 px-4 py-2 pr-10 text-sm bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
                />
                <div className="absolute right-3 top-2.5">
                  {searchLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <svg
                      className="h-5 w-5 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {/* Center: Total Count */}
            <div className="text-center">
              <h3 className="text-xl font-bold text-black">
                {loading ? "..." : pagination.totalItems}
              </h3>
              <p className="text-sm text-gray-700">Total number of Customers</p>
            </div>

            {/* Right: Add Button */}
            <button
              onClick={openAddCustomer}
              disabled={loading}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-5 py-2 rounded-lg shadow-md text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Customer
            </button>
          </div>
        </div>
      </div>

      {/* Table Card with Fixed Scrolling */}
      <div className="bg-white rounded-xl shadow-lg flex-1 flex flex-col overflow-hidden">
        {/* Header with pagination */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 sm:px-6 py-3 border-b border-gray-200 flex-shrink-0 gap-3">
          <h2 className="text-lg font-semibold text-black">All Customers</h2>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
            {/* Pagination Info */}
            <div className="text-sm text-gray-600 order-2 sm:order-1">
              {loading
                ? "Loading..."
                : `Showing ${(currentPage - 1) * pagination.itemsPerPage + 1
                } to ${Math.min(
                  currentPage * pagination.itemsPerPage,
                  pagination.totalItems
                )} of ${pagination.totalItems}`}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1 order-1 sm:order-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={!pagination.hasPrevPage || loading}
                className="p-2 rounded-lg bg-white border border-gray-300 text-black hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from(
                  { length: Math.max(1, pagination.totalPages) },
                  (_, i) => i + 1
                )
                  .filter((page) => {
                    if (pagination.totalPages > 5) {
                      return Math.abs(page - currentPage) <= 1 || page === 1 || page === pagination.totalPages;
                    }
                    return true;
                  })
                  .map((page, index, array) => {
                    const showEllipsis = pagination.totalPages > 5 &&
                      index > 0 &&
                      array[index - 1] !== page - 1 &&
                      page !== 1;

                    return (
                      <div key={page} className="flex items-center gap-1">
                        {showEllipsis && <span className="text-gray-500 text-sm">...</span>}
                        <button
                          onClick={() => goToPage(page)}
                          disabled={loading}
                          className={`px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium transition-colors duration-150 disabled:opacity-50 ${currentPage === page
                              ? "bg-red-500 text-white border-red-500"
                              : "bg-white text-black hover:bg-slate-50"
                            }`}
                        >
                          {page}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={!pagination.hasNextPage || loading}
                className="p-2 rounded-lg bg-white border border-gray-300 text-black hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Table Content with Proper Scrolling */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <LoadingSpinner size="lg" />
                <p className="text-gray-500 mt-4">Loading customers...</p>
              </div>
            </div>
          ) : customers.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-gray-500 text-lg">No customers found</p>
                <p className="text-gray-400 text-sm mt-2">
                  {search
                    ? `No results for "${search}"`
                    : "Add your first customer to get started"}
                </p>
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="mt-4 text-red-500 hover:text-red-600 text-sm"
                  >
                    Clear search
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Mobile: Card Layout */}
              <div className="block sm:hidden p-4 space-y-3">
                {customers.map((customer, index) => (
                  <div
                    key={customer.id}
                    data-customer-row={customer.id}
                    className={`rounded-lg p-4 border transition-all duration-200 ${hasUnpaidAmount(customer.id)
                        ? "bg-yellow-50 border-yellow-200 shadow-sm"
                        : "bg-gray-50 border-gray-200"
                      }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-black text-sm truncate">
                            {customer.name}
                          </h3>
                          {hasUnpaidAmount(customer.id) && (
                            <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full font-medium">
                              ₹{getCustomerUnpaidAmount(customer.id)} due
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">ID: {customer.customerId || customer.displayId || String(customer.id).padStart(4, "0")}</p>                        <p className="text-xs text-gray-600">{customer.phone}</p>
                      </div>
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {!customer.rfid && (
                          <button
                            onClick={() => openAssign(customer)}
                            className="bg-indigo-500 hover:bg-indigo-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors duration-150"
                          >
                            + Card
                          </button>
                        )}
                        <button
                          onClick={() => openPayModal(customer)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors duration-150"
                        >
                          Pay
                        </button>
                        <button
                          onClick={() => openStandingModal(customer)}
                          className="bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors duration-150"
                        >
                          Standing
                        </button>
                        <button
                          onClick={() => handleInvoiceClick(customer)}
                          className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors duration-150"
                        >
                          Invoice
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditCustomer(customer)}
                        disabled={modalLoading}
                        className="p-2 rounded-lg bg-red-100 hover:bg-red-200 transition-colors duration-150 disabled:opacity-50"
                      >
                        <PencilIcon className="h-4 w-4 text-red-600" />
                      </button>
                      <button
                        onClick={() => openDeleteConfirmation(customer)}
                        disabled={deleteLoading}
                        className="p-2 rounded-lg bg-red-100 hover:bg-red-200 transition-colors duration-150 disabled:opacity-50"
                      >
                        <TrashIcon className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: Table Layout with Horizontal Scroll */}
              <div className="hidden sm:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="text-black font-medium">
                        <th className="text-center px-6 py-3 w-32">Customer ID</th>
                        <th className="text-center px-6 py-3 w-64">Name</th>
                        <th className="text-center px-6 py-3 w-40">Phone Number</th>
                        <th className="text-center px-6 py-3 w-32">Outstanding</th>
                        <th className="text-center px-6 py-3 w-20">Edit</th>
                        <th className="text-center px-6 py-3 w-20">Delete</th>
                        <th className="text-center px-6 py-3 w-24">Invoice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((customer, index) => (
                        <tr
                          key={customer.id}
                          data-customer-row={customer.id}
                          className={`transition-all duration-200 ${hasUnpaidAmount(customer.id)
                              ? "bg-yellow-50 hover:bg-yellow-100 border-l-4 border-l-yellow-400"
                              : "hover:bg-gray-50"
                            } ${index !== customers.length - 1
                              ? "border-b border-gray-200"
                              : ""
                            }`}
                        >
                          <td className="text-center px-6 py-4 text-black w-32">
                            {customer.customerId || customer.displayId || String(customer.id).padStart(4, "0")}
                          </td>
                          <td className="text-center px-6 py-4 text-black w-64 truncate">
                            {customer.name}
                          </td>
                          <td className="text-center px-6 py-4 text-black w-40">
                            {customer.phone}
                          </td>
                          <td className="text-center px-6 py-4 w-32">
                            {hasUnpaidAmount(customer.id) ? (
                              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                                ₹{getCustomerUnpaidAmount(customer.id)}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="text-center px-6 py-4 w-20">
                            <button
                              onClick={() => openEditCustomer(customer)}
                              disabled={modalLoading}
                              className="p-1 rounded hover:bg-gray-200 transition-colors duration-150 disabled:opacity-50"
                            >
                              <PencilIcon className="h-5 w-5 text-gray-700 hover:text-red-600" />
                            </button>
                          </td>
                          <td className="text-center px-6 py-4 w-20">
                            <button
                              onClick={() => openDeleteConfirmation(customer)}
                              disabled={deleteLoading}
                              className="p-1 rounded hover:bg-gray-200 transition-colors duration-150 disabled:opacity-50"
                            >
                              <TrashIcon className="h-5 w-5 text-gray-700 hover:text-red-600" />
                            </button>
                          </td>
                          <td className="text-center px-6 py-4 w-36">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {!customer.rfid && (
                                <button
                                  onClick={() => openAssign(customer)}
                                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-2.5 py-1 rounded text-xs font-medium transition-colors duration-150"
                                >
                                  + Card
                                </button>
                              )}
                              <button
                                onClick={() => openPayModal(customer)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1 rounded text-xs font-medium transition-colors duration-150"
                              >
                                Pay
                              </button>
                              <button
                                onClick={() => openStandingModal(customer)}
                                className="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded text-xs font-medium transition-colors duration-150"
                              >
                                Standing
                              </button>
                              <button
                                onClick={() => handleInvoiceClick(customer)}
                                className="bg-green-500 hover:bg-green-600 text-white px-2.5 py-1 rounded text-xs font-medium transition-colors duration-150"
                              >
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Assign Card (RFID) Modal */}
      {showAssign && assignCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={closeAssign}>
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-black mb-1">Assign Card</h2>
            <p className="text-sm text-gray-500 mb-4">Tap the RFID card to link it to {assignCustomer.name}.</p>
            {assignErr && <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">{assignErr}</div>}
            <form onSubmit={(e) => { e.preventDefault(); submitAssign(); }}>
              <input
                type="text"
                autoFocus
                value={assignRfid}
                onChange={(e) => setAssignRfid(e.target.value)}
                placeholder="Tap card — number appears here"
                className="w-full px-3 py-3 border border-gray-300 rounded-lg text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#E54A4A]"
              />
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={closeAssign} disabled={assignSaving} className="flex-1 bg-white border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={assignSaving || !assignRfid.trim()} className="flex-1 bg-[#E54A4A] hover:bg-[#d63939] text-white py-2.5 rounded-lg font-semibold disabled:opacity-50">
                  {assignSaving ? "Saving…" : "Assign card"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Standing Order Modal (daily delivery round) */}
      {showStandingModal && standingCustomer && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4"
          onClick={closeStandingModal}
        >
          <div
            className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-black mb-1">Standing Order</h2>
            <p className="text-sm text-gray-500 mb-4">
              {standingCustomer.name}'s usual daily delivery
            </p>

            {error && (
              <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Existing standing lines */}
            <div className="space-y-2 mb-4">
              {standingList.length === 0 ? (
                <p className="text-sm text-gray-400">No standing order yet.</p>
              ) : (
                standingList.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <span className="text-sm text-black">
                      {s.item_name} — <span className="font-medium">{s.quantity} {s.sale_unit}</span>/day
                    </span>
                    <button
                      onClick={() => removeStanding(s.id)}
                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add a line */}
            <div className="border-t border-gray-200 pt-4">
              <p className="text-xs font-medium text-gray-600 mb-2">Add item</p>
              <div className="flex gap-2">
                <select
                  value={standingItemId}
                  onChange={(e) => setStandingItemId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Select item…</option>
                  {itemsForPicker.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} {i.pricingMode === "loose" ? `(₹${i.price}/${i.rateUnit})` : `(₹${i.price})`}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={standingQty}
                  onChange={(e) => setStandingQty(e.target.value)}
                  placeholder="Qty"
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              {standingItemId && (
                <p className="text-xs text-gray-500 mt-1">
                  {(() => {
                    const it = itemsForPicker.find((i) => i.id === standingItemId);
                    if (!it) return null;
                    const unit = it.pricingMode === "loose" ? it.rateUnit : "piece";
                    return `Will deliver ${standingQty || 0} ${unit}/day`;
                  })()}
                </p>
              )}
              <button
                onClick={addStandingOrder}
                disabled={standingSaving || !standingItemId}
                className="mt-3 w-full bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {standingSaving ? "Saving…" : "Add to standing order"}
              </button>
            </div>

            <button
              onClick={closeStandingModal}
              className="mt-4 w-full bg-white border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPayModal && payCustomer && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4"
          onClick={closePayModal}
        >
          <div
            className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-black mb-1">Record Payment</h2>
            <p className="text-sm text-gray-500 mb-4">
              {payCustomer.name} ·{" "}
              <span className={getCustomerUnpaidAmount(payCustomer.id) > 0 ? "text-red-600 font-medium" : "text-gray-500"}>
                ₹{getCustomerUnpaidAmount(payCustomer.id)} due
              </span>
            </p>

            {error && (
              <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitPayment();
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-medium text-gray-600">Amount (₹) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  autoFocus
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="e.g. 200"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">Method</label>
                <div className="flex gap-2 mt-1">
                  {["cash", "upi", "other"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMethod(m)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                        payMethod === m ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">Note (optional)</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="e.g. against last month"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closePayModal}
                  disabled={paySaving}
                  className="flex-1 bg-white border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySaving || !payAmount}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50"
                >
                  {paySaving ? "Saving…" : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* All the existing modals remain the same... */}
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && deletingCustomer && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeAllModals}
          >
            <motion.div
              className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-md mx-auto shadow-2xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <ExclamationIcon className="h-12 sm:h-16 w-12 sm:w-16 text-red-500 mx-auto mb-3 sm:mb-4" />
                <h2 className="text-lg sm:text-xl font-semibold text-black mb-2">
                  Delete Customer
                </h2>
                <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-black">
                    {deletingCustomer.name}
                  </span>
                  ?
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">
                  This action cannot be undone.
                </p>

                {error && (
                  <div className="mb-3 sm:mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                    <p className="text-red-700 text-xs sm:text-sm">{error}</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    onClick={closeAllModals}
                    disabled={deleteLoading}
                    className="flex-1 bg-white border border-gray-300 text-black py-2 sm:py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors duration-150 disabled:opacity-50 text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteCustomer}
                    disabled={deleteLoading}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 sm:py-3 px-4 rounded-lg font-semibold transition-colors duration-150 disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    {deleteLoading ? (
                      <>
                        <LoadingSpinner size="sm" />
                        Deleting...
                      </>
                    ) : (
                      "Delete Customer"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RFID Input Modal */}
      <AnimatePresence>
        {showRfidModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeAllModals}
          >
            <motion.div
              className="bg-white rounded-2xl p-4 sm:p-6 lg:p-8 w-full max-w-md mx-auto shadow-2xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="mb-4 sm:mb-6">
                  <CreditCardIcon className="h-12 sm:h-16 w-12 sm:w-16 text-red-500 mx-auto mb-3 sm:mb-4" />
                  <h2 className="text-lg sm:text-xl font-semibold text-black mb-2">
                    Tap Your RFID
                  </h2>
                  <p className="text-gray-600 text-sm">
                    Please tap your RFID card on the scanner
                  </p>
                </div>

                <form onSubmit={handleRfidSubmit} className="space-y-3 sm:space-y-4">
                  <div>
                    <input
                      ref={rfidInputRef}
                      type="text"
                      value={rfidInput}
                      onChange={handleRfidInput}
                      placeholder="RFID will appear here..."
                      disabled={rfidValidating}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg bg-white text-black text-center text-base sm:text-lg font-mono focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
                      autoComplete="off"
                    />
                  </div>

                  {rfidError && (
                    <div className="p-3 bg-red-100 border border-red-300 rounded-lg">
                      <p className="text-red-700 text-xs sm:text-sm">{rfidError}</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={closeAllModals}
                      disabled={rfidValidating}
                      className="w-full sm:w-auto flex-1 bg-white border border-gray-300 text-black py-2 sm:py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors duration-150 disabled:opacity-50 text-sm sm:text-base"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!rfidInput.trim() || rfidValidating}
                      className="w-full sm:w-auto flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 sm:py-3 px-4 rounded-lg font-semibold transition-colors duration-150 flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      {rfidValidating ? (
                        <>
                          <LoadingSpinner size="sm" />
                          Validating...
                        </>
                      ) : (
                        "Continue"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customer Details Modal */}
      <AnimatePresence>
        {showDetailsModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeAllModals}
          >
            <motion.div
              className="bg-white rounded-2xl p-4 sm:p-6 lg:p-8 w-full max-w-md mx-auto shadow-2xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg sm:text-xl font-semibold text-black mb-4 sm:mb-6">
                {editingCustomer ? "Edit Customer" : "Add New Customer"}
              </h2>

              {error && (
                <div className="mb-3 sm:mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                  <p className="text-red-700 text-xs sm:text-sm">{error}</p>
                </div>
              )}

              {rfidNumber && (
                <div className="mb-3 sm:mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-xs sm:text-sm">
                    RFID: <span className="font-mono">{rfidNumber}</span>
                  </p>
                </div>
              )}

              <div className="space-y-3 sm:space-y-4">
                {/* Name */}
                <div>
                  <label className="text-xs sm:text-sm text-black font-medium">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={customerDetails.name}
                    onChange={(e) =>
                      setCustomerDetails({
                        ...customerDetails,
                        name: e.target.value,
                      })
                    }
                    disabled={modalLoading}
                    className="w-full mt-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-slate-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="text-xs sm:text-sm text-black font-medium">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit phone number"
                    value={customerDetails.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, ""); // Only allow digits
                      if (value.length <= 10) {
                        setCustomerDetails({
                          ...customerDetails,
                          phone: value,
                        });
                      }
                    }}
                    disabled={modalLoading}
                    className={`w-full mt-1 px-3 sm:px-4 py-2 border rounded-lg bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-slate-50 disabled:cursor-not-allowed text-sm sm:text-base ${customerDetails.phone &&
                        customerDetails.phone.length !== 10
                        ? "border-red-300 focus:ring-red-500"
                        : "border-gray-300"
                      }`}
                    maxLength="10"
                  />
                  {customerDetails.phone &&
                    customerDetails.phone.length !== 10 && (
                      <p className="text-red-500 text-xs mt-1">
                        Phone number must be exactly 10 digits
                      </p>
                    )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-4 sm:mt-6">
                <button
                  onClick={closeAllModals}
                  disabled={modalLoading}
                  className="w-full sm:w-auto px-4 sm:px-5 py-2 bg-white border border-gray-300 text-black rounded-lg hover:bg-gray-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCustomer}
                  disabled={
                    modalLoading ||
                    !customerDetails.name.trim() ||
                    !customerDetails.phone ||
                    !rfidNumber
                  }
                  className="w-full sm:w-auto px-4 sm:px-5 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-semibold hover:from-red-600 hover:to-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  {modalLoading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      {editingCustomer ? "Updating..." : "Creating..."}
                    </>
                  ) : editingCustomer ? (
                    "Update Customer"
                  ) : (
                    "Add Customer"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}