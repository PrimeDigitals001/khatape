import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PencilIcon,
  TrashIcon,
  PlusIcon,
  UploadIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationIcon,
} from "@heroicons/react/outline";
import { adminAPI } from "../services/adminAPI";

export default function ManageItems() {
  const focusParams =
    window.history.state && window.history.state.usr
      ? window.history.state.usr
      : null;
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [newItem, setNewItem] = useState({
    name: "",
    capacity: "",
    price: "",
    image: null,
    imageUrl: "",
    pricingMode: "packaged",
    rateUnit: "piece",
  });
  const [imageMethod, setImageMethod] = useState("url"); // "url" or "upload"

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
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
  const [imageUploading, setImageUploading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  // Load items on component mount and when search/page changes
  useEffect(() => {
    loadItems();
  }, [currentPage]);

  // Handle search with debounce
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (search !== "") {
        handleSearch();
      } else {
        loadItems();
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [search]);

  // Load items from API
  const loadItems = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await adminAPI.getItems(currentPage, 10, search);
      setItems(response.data.items);
      setPagination(response.data.pagination);
      // If navigated with focusId, scroll and highlight
      if (
        focusParams &&
        focusParams.focusType === "item" &&
        focusParams.focusId
      ) {
        setTimeout(() => {
          const row = document.querySelector(
            `[data-item-row="${focusParams.focusId}"]`
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
      console.error("Failed to load items:", error);
      setError("Failed to load items. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle search
  const handleSearch = async () => {
    try {
      setSearchLoading(true);
      setError(null);
      setCurrentPage(1); // Reset to first page when searching

      const response = await adminAPI.getItems(1, 10, search);
      setItems(response.data.items);
      setPagination(response.data.pagination);
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

  const openModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setNewItem({
        name: item.name,
        capacity: item.capacity || "",
        price: item.price,
        image: item.image,
        imageUrl: item.image || "",
        pricingMode: item.pricingMode || "packaged",
        rateUnit: item.rateUnit || "piece",
      });
      // Determine which method was used based on existing image
      setImageMethod(
        item.image && item.image.startsWith("http") ? "url" : "upload"
      );
    } else {
      setEditingItem(null);
      setNewItem({
        name: "",
        capacity: "",
        price: "",
        image: null,
        imageUrl: "",
        pricingMode: "packaged",
        rateUnit: "piece",
      });
      setImageMethod("url");
    }
    setError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setNewItem({
      name: "",
      capacity: "",
      price: "",
      image: null,
      imageUrl: "",
      pricingMode: "packaged",
      rateUnit: "piece",
    });
    setImageMethod("url");
    setError(null);
    setImageUploading(false);
  };

  const openDeleteConfirmation = (item) => {
    setDeletingItem(item);
    setShowDeleteModal(true);
    setError(null);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingItem(null);
    setError(null);
  };

  // Handle save item (create or update)
  const handleSaveItem = async () => {
    const isLoose = newItem.pricingMode === "loose";
    if (!newItem.name.trim() || !newItem.price || (!isLoose && !newItem.capacity)) {
      setError("Please fill in all required fields");
      return;
    }

    if (parseFloat(newItem.price) <= 0) {
      setError("Price must be greater than 0");
      return;
    }

    setModalLoading(true);
    setError(null);

    try {
      // Prepare item data - use the selected method's value
      const itemData = {
        name: newItem.name,
        capacity: isLoose ? "" : newItem.capacity,
        price: newItem.price,
        image: imageMethod === "url" ? newItem.imageUrl : newItem.image,
        pricingMode: newItem.pricingMode,
        rateUnit: isLoose ? newItem.rateUnit : "piece",
      };

      let response;

      if (editingItem) {
        // Update existing item
        response = await adminAPI.updateItem(editingItem.id, itemData);
        setSuccessMessage("Item updated successfully!");
      } else {
        // Create new item
        response = await adminAPI.createItem(itemData);
        setSuccessMessage("Item created successfully!");
      }

      // Reload items to get updated data
      await loadItems();
      closeModal();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Save item failed:", error);
      setError(error.message || "Failed to save item. Please try again.");
    } finally {
      setModalLoading(false);
    }
  };

  // Handle delete item
  const confirmDeleteItem = async () => {
    if (!deletingItem) return;

    setDeleteLoading(true);
    setError(null);

    try {
      await adminAPI.deleteItem(deletingItem.id);
      setSuccessMessage("Item deleted successfully!");

      // Reload items
      await loadItems();
      closeDeleteModal();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Delete item failed:", error);
      setError(error.message || "Failed to delete item. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImageUploading(true);
    setError(null);

    try {
      const response = await adminAPI.uploadImage(file);
      setNewItem({ ...newItem, image: response.data.url, imageUrl: "" }); // Clear URL when uploading
    } catch (error) {
      console.error("Image upload failed:", error);
      setError(error.message || "Failed to upload image. Please try again.");
    } finally {
      setImageUploading(false);
    }
  };

  // Handle method switching
  const handleMethodSwitch = (method) => {
    setImageMethod(method);
    if (method === "url") {
      // Clear uploaded image when switching to URL
      setNewItem({ ...newItem, image: null });
    } else {
      // Clear URL when switching to upload
      setNewItem({ ...newItem, imageUrl: "" });
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

      {/* Compact Header Card */}
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
            placeholder="Search items..."
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
          onClick={() => openModal()}
          disabled={loading}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          Add Item
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
          Quick search an Item
        </label>
        <div className="relative mt-1">
          <input
            id="search"
            type="text"
            placeholder="Enter Item Name"
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
        <p className="text-sm text-gray-700">Total Items</p>
      </div>

      {/* Right: Add Button */}
      <button
        onClick={() => openModal()}
        disabled={loading}
        className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-5 py-2 rounded-lg shadow-md text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Add New Item
      </button>
    </div>
  </div>
</div>

      {/* Table Card with Fixed Scrolling */}
      <div className="bg-white rounded-xl shadow-lg flex-1 flex flex-col overflow-hidden">
        {/* Header with pagination */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 sm:px-6 py-3 border-b border-gray-200 flex-shrink-0 gap-3">
          <h2 className="text-lg font-semibold text-black">All Items</h2>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
            {/* Pagination Info */}
            <div className="text-sm text-gray-600 order-2 sm:order-1">
              {loading
                ? "Loading..."
                : `Showing ${
                    (currentPage - 1) * pagination.itemsPerPage + 1
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
                          className={`px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium transition-colors duration-150 disabled:opacity-50 ${
                            currentPage === page
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
                <p className="text-gray-500 mt-4">Loading items...</p>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-gray-500 text-lg">No items found</p>
                <p className="text-gray-400 text-sm mt-2">
                  {search
                    ? `No results for "${search}"`
                    : "Add your first item to get started"}
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
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    data-item-row={item.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-black text-sm truncate">
                          {item.name}
                        </h3>
                        <p className="text-xs text-gray-600 mt-1">{item.displayId || item.id}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-black text-sm">₹{item.price}{item.pricingMode === "loose" ? `/${item.rateUnit}` : ""}</p>
                        <p className="text-xs text-gray-600">{item.pricingMode === "loose" ? "Loose" : item.capacity}</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openModal(item)}
                        disabled={modalLoading}
                        className="p-2 rounded-lg bg-red-100 hover:bg-red-200 transition-colors duration-150 disabled:opacity-50"
                      >
                        <PencilIcon className="h-4 w-4 text-red-600" />
                      </button>
                      <button
                        onClick={() => openDeleteConfirmation(item)}
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
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="text-black font-medium">
                        <th className="text-center px-6 py-3 w-32">Item ID</th>
                        <th className="text-center px-6 py-3 w-64">Item Name</th>
                        <th className="text-center px-6 py-3 w-32">Capacity</th>
                        <th className="text-center px-6 py-3 w-20">Edit</th>
                        <th className="text-center px-6 py-3 w-20">Delete</th>
                        <th className="text-center px-6 py-3 w-32">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr
                          key={item.id}
                          data-item-row={item.id}
                          className={`hover:bg-gray-50 transition-colors duration-150 ${
                            index !== items.length - 1
                              ? "border-b border-gray-200"
                              : ""
                          }`}
                        >
                          <td className="text-center px-6 py-4 text-black w-32">
                            {item.displayId || item.id}
                          </td>
                          <td className="text-center px-6 py-4 text-black w-64 truncate">
                            {item.name}
                          </td>
                          <td className="text-center px-6 py-4 text-black w-32">
                            {item.pricingMode === "loose"
                              ? <span className="inline-block bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-medium">Loose · /{item.rateUnit}</span>
                              : item.capacity}
                          </td>
                          <td className="text-center px-6 py-4 w-20">
                            <button
                              onClick={() => openModal(item)}
                              disabled={modalLoading}
                              className="p-1 rounded hover:bg-gray-200 transition-colors duration-150 disabled:opacity-50"
                            >
                              <PencilIcon className="h-5 w-5 text-gray-700 hover:text-red-600" />
                            </button>
                          </td>
                          <td className="text-center px-6 py-4 w-20">
                            <button
                              onClick={() => openDeleteConfirmation(item)}
                              disabled={deleteLoading}
                              className="p-1 rounded hover:bg-gray-200 transition-colors duration-150 disabled:opacity-50"
                            >
                              <TrashIcon className="h-5 w-5 text-gray-700 hover:text-red-600" />
                            </button>
                          </td>
                          <td className="text-center px-6 py-4 text-black font-medium w-32">
                            ₹{item.price}{item.pricingMode === "loose" ? <span className="text-xs font-normal text-gray-500">/{item.rateUnit}</span> : null}
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && deletingItem && (
          <motion.div
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex justify-center items-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDeleteModal}
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
                  Delete Item
                </h2>
                <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-black">
                    {deletingItem.name}
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
                    onClick={closeDeleteModal}
                    disabled={deleteLoading}
                    className="flex-1 bg-white border border-gray-300 text-black py-2 sm:py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors duration-150 disabled:opacity-50 text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteItem}
                    disabled={deleteLoading}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 sm:py-3 px-4 rounded-lg font-semibold transition-colors duration-150 disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    {deleteLoading ? (
                      <>
                        <LoadingSpinner size="sm" />
                        Deleting...
                      </>
                    ) : (
                      "Delete Item"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Item Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex justify-center items-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              className="bg-white rounded-2xl p-4 sm:p-6 lg:p-8 w-full max-w-md mx-auto shadow-2xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg sm:text-xl font-semibold text-black mb-4 sm:mb-6">
                {editingItem ? "Edit Item" : "Add New Item"}
              </h2>

              {error && (
                <div className="mb-3 sm:mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                  <p className="text-red-700 text-xs sm:text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-3 sm:space-y-4">
                {/* Name */}
                <div>
                  <label className="text-xs sm:text-sm text-black font-medium">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={newItem.name}
                    onChange={(e) =>
                      setNewItem({ ...newItem, name: e.target.value })
                    }
                    disabled={modalLoading}
                    className="w-full mt-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-slate-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  />
                </div>

                {/* Item type: packaged (per piece) vs loose (by weight/volume) */}
                <div>
                  <label className="text-xs sm:text-sm text-black font-medium mb-1 block">
                    Item Type *
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewItem({ ...newItem, pricingMode: "packaged", rateUnit: "piece" })}
                      disabled={modalLoading}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-50 ${
                        newItem.pricingMode === "packaged" ? "bg-red-500 text-white" : "bg-slate-50 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      Packaged (per piece)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewItem({ ...newItem, pricingMode: "loose", rateUnit: newItem.rateUnit === "piece" ? "kg" : newItem.rateUnit })}
                      disabled={modalLoading}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-50 ${
                        newItem.pricingMode === "loose" ? "bg-amber-500 text-white" : "bg-slate-50 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      Loose (by weight/volume)
                    </button>
                  </div>
                </div>

                {newItem.pricingMode === "packaged" ? (
                  /* Capacity (packaged only) */
                  <div>
                    <label className="text-xs sm:text-sm text-black font-medium">Capacity *</label>
                    <input
                      type="text"
                      placeholder="Enter capacity (e.g., 100 ml, 1 Ltr)"
                      value={newItem.capacity}
                      onChange={(e) => setNewItem({ ...newItem, capacity: e.target.value })}
                      disabled={modalLoading}
                      className="w-full mt-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-slate-50 disabled:cursor-not-allowed text-sm sm:text-base"
                    />
                  </div>
                ) : (
                  /* Rate unit (loose only) — price will be per this unit */
                  <div>
                    <label className="text-xs sm:text-sm text-black font-medium">Sold by (unit) *</label>
                    <select
                      value={newItem.rateUnit}
                      onChange={(e) => setNewItem({ ...newItem, rateUnit: e.target.value })}
                      disabled={modalLoading}
                      className="w-full mt-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-50 text-sm sm:text-base"
                    >
                      <option value="kg">per kg</option>
                      <option value="g">per g</option>
                      <option value="l">per litre (l)</option>
                      <option value="ml">per ml</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Price below is per {newItem.rateUnit}.</p>
                  </div>
                )}

                {/* Image Method Selection */}
                <div>
                  <label className="text-xs sm:text-sm text-black font-medium mb-2 sm:mb-3 block">
                    Image Source
                  </label>
                  <div className="flex gap-2 mb-3 sm:mb-4">
                    <button
                      type="button"
                      onClick={() => handleMethodSwitch("url")}
                      disabled={modalLoading}
                      className={`flex-1 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-150 disabled:opacity-50 ${
                        imageMethod === "url"
                          ? "bg-red-500 text-white"
                          : "bg-slate-50 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      Enter URL
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMethodSwitch("upload")}
                      disabled={modalLoading}
                      className={`flex-1 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-150 disabled:opacity-50 ${
                        imageMethod === "upload"
                          ? "bg-red-500 text-white"
                          : "bg-slate-50 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      Upload File
                    </button>
                  </div>
                </div>

                {/* Image URL Input */}
                {imageMethod === "url" && (
                  <div>
                    <label className="text-xs sm:text-sm text-black font-medium">
                      Image URL
                    </label>
                    <input
                      type="url"
                      placeholder="Enter image URL"
                      value={newItem.imageUrl}
                      onChange={(e) =>
                        setNewItem({ ...newItem, imageUrl: e.target.value })
                      }
                      disabled={modalLoading}
                      className="w-full mt-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-slate-50 disabled:cursor-not-allowed text-sm sm:text-base"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter a direct image URL
                    </p>
                  </div>
                )}

                {/* Image Upload */}
                {imageMethod === "upload" && (
                  <div>
                    <label className="text-xs sm:text-sm text-black font-medium">
                      Upload Image File
                    </label>
                    <div className="mt-1 p-3 sm:p-4 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-gray-400 transition-colors duration-150 relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={modalLoading || imageUploading}
                        className="absolute w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                      {imageUploading ? (
                        <div className="flex flex-col items-center">
                          <LoadingSpinner size="sm" />
                          <span className="text-xs sm:text-sm text-red-600 mt-2">
                            Uploading...
                          </span>
                        </div>
                      ) : newItem.image ? (
                        <div className="flex flex-col items-center">
                          <img
                            src={newItem.image}
                            alt="Preview"
                            className="w-12 sm:w-16 h-12 sm:h-16 object-cover rounded-lg"
                          />
                          <span className="text-xs text-green-600 mt-2">
                            Image uploaded
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <UploadIcon className="w-6 sm:w-8 h-6 sm:h-8 text-gray-400" />
                          <span className="text-xs sm:text-sm text-gray-600 mt-2">
                            Click to upload image
                          </span>
                          <span className="text-xs text-gray-500">
                            or drag and drop
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Price */}
                <div>
                  <label className="text-xs sm:text-sm text-black font-medium">
                    {newItem.pricingMode === "loose" ? `Price per ${newItem.rateUnit} *` : "Item Price *"}
                  </label>
                  <input
                    type="number"
                    placeholder="Enter Price"
                    value={newItem.price}
                    onChange={(e) =>
                      setNewItem({ ...newItem, price: e.target.value })
                    }
                    disabled={modalLoading}
                    min="0"
                    step="0.01"
                    className="w-full mt-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-slate-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-4 sm:mt-6">
                <button
                  onClick={closeModal}
                  disabled={modalLoading || imageUploading}
                  className="w-full sm:w-auto px-4 sm:px-5 py-2 bg-white border border-gray-300 text-black rounded-lg hover:bg-gray-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveItem}
                  disabled={
                    modalLoading ||
                    imageUploading ||
                    !newItem.name.trim() ||
                    (newItem.pricingMode === "packaged" && !newItem.capacity) ||
                    !newItem.price
                  }
                  className="w-full sm:w-auto px-4 sm:px-5 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-semibold hover:from-red-600 hover:to-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  {modalLoading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      {editingItem ? "Updating..." : "Creating..."}
                    </>
                  ) : editingItem ? (
                    "Update Item"
                  ) : (
                    "Add Item"
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