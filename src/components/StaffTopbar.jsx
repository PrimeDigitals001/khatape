import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch } from "react-icons/fi";
import { staffAPI } from "../services/staffAPI"; // Add this import
import { useAuth } from "../auth/AuthContext";

export default function StaffTopbar() {
  const navigate = useNavigate();
  const { logout, user, role, loading: authLoading } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Listen for customer updates from PointOfSale
  useEffect(() => {
    const handleCustomerUpdate = (event) => {
      setCustomer(event.detail);
    };

    window.addEventListener("customerUpdate", handleCustomerUpdate);

    return () => {
      window.removeEventListener("customerUpdate", handleCustomerUpdate);
    };
  }, []);

  // Search functionality
  const handleSearch = async (query) => {
    setSearchQuery(query);

    if (query.trim().length < 2) {
      setShowSearchResults(false);
      return;
    }

    setSearchLoading(true);
    try {
      // Search items by name
      const response = await staffAPI.searchItems(query);
      setSearchResults(response.data || []);
      setShowSearchResults(true);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle search input with debounce
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  // Handle rescan functionality
  const handleRescan = () => {
    // Dispatch event to reset PointOfSale to scanning mode
    window.dispatchEvent(new CustomEvent("resetToScan"));
    setCustomer(null);
  };

  // Get user display information
  const getUserDisplayInfo = () => {
    if (!user) return null;
    
    return {
      name: user.displayName || user.email?.split('@')[0] || 'User',
      email: user.email,
      role: role || 'Staff',
    };
  };

  const currentUser = getUserDisplayInfo();

  return (
    <div className="w-full bg-white border-b border-gray-200 shadow-sm relative">
      {isMobile ? (
        // Mobile Layout
        <div className="flex flex-col">
          {/* Top Row: Logo and Staff Info */}
          <div className="flex justify-between items-center p-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white text-sm">K</div>
              <span className="font-semibold text-slate-900">Khatape</span>
            </div>
            
            {/* Staff Info - Compact */}
            {authLoading ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                <div className="w-16 h-3 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ) : currentUser ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2">
                <div className="text-left">
                  <p className="text-xs font-semibold text-black">{currentUser.name}</p>
                  <p className="text-xs text-gray-600">{currentUser.role}</p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await logout();
                      navigate("/login", { replace: true });
                    } catch (e) {
                      console.error("Logout failed", e);
                    }
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white p-1 rounded text-xs"
                  title="Logout"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                <p className="text-xs text-gray-500">Not logged in</p>
              </div>
            )}
          </div>

          {/* Search Bar Row */}
          <div className="px-3 pb-3">
            <div className="relative">
              <div className="flex items-center bg-gray-100 rounded-full px-3 py-2 border border-gray-200 focus-within:ring-2 focus-within:ring-[#E54A4A] focus-within:border-[#E54A4A] transition-all duration-200">
                <FiSearch className="text-gray-500 mr-2 flex-shrink-0" size={16} />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery && setShowSearchResults(true)}
                  onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                  className="bg-transparent outline-none w-full text-black placeholder-gray-500 text-sm"
                />
                {searchLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#E54A4A] ml-2"></div>
                )}
              </div>

              {/* Search Results Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto z-50">
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("addItemToCart", { detail: item })
                        );
                        setShowSearchResults(false);
                        setSearchQuery("");
                      }}
                    >
                      <div className="w-10 h-10 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                            IMG
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-black text-sm">{item.name}</p>
                        <p className="text-xs text-gray-600">
                          {item.measurement} • ₹{item.price}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Customer Info Row */}
          <div className="px-3 pb-3">
            {customer ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-black">{customer.name}</p>
                  <p className="text-xs text-gray-600">Phone: {customer.phone}</p>
                  <p className="text-xs text-gray-600">ID: {customer.id}</p>
                </div>
                <button
                  onClick={handleRescan}
                  className="bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-md transition-colors duration-200"
                  title="Rescan RFID"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-sm font-medium text-gray-500">No customer scanned</p>
                <p className="text-xs text-gray-400">Scan RFID card to begin</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Desktop Layout
        <div className="flex justify-between items-center p-4">
          {/* Brand */}
          <div className="flex items-center gap-2 pl-4">
            <div className="h-9 w-9 rounded-xl bg-red-600 flex items-center justify-center font-bold text-white">K</div>
            <span className="font-semibold text-slate-900 text-lg">Khatape</span>
          </div>

          {/* Search Bar with Results */}
          <div className="relative">
            <div className="flex items-center bg-gray-100 rounded-full px-4 py-2 w-96 border border-gray-200 focus-within:ring-2 focus-within:ring-[#E54A4A] focus-within:border-[#E54A4A] transition-all duration-200">
              <FiSearch className="text-gray-500 mr-3 flex-shrink-0" size={18} />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery && setShowSearchResults(true)}
                onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                className="bg-transparent outline-none w-full text-black placeholder-gray-500 text-sm"
              />
              {searchLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#E54A4A] ml-2"></div>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto z-50">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("addItemToCart", { detail: item })
                      );
                      setShowSearchResults(false);
                      setSearchQuery("");
                    }}
                  >
                    <div className="w-10 h-10 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                          IMG
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-black text-sm">{item.name}</p>
                      <p className="text-xs text-gray-600">
                        {item.measurement} • ₹{item.price}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right side: Customer Info + Staff Info with Logout */}
          <div className="flex items-center gap-4 pr-4">
            {/* Customer Info with Rescan Button */}
            <div className="text-right">
              {customer ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 h-20 flex items-center">
                  <div className="flex items-center gap-3 w-full">
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-black">
                        Name: {customer.name}
                      </p>
                      <p className="text-xs text-gray-600">Phone: {customer.phone}</p>
                      <p className="text-xs text-gray-600">
                        Customer ID: {customer.id}
                      </p>
                    </div>
                    <button
                      onClick={handleRescan}
                      className="bg-orange-500 hover:bg-orange-600 text-white p-1.5 rounded-md transition-colors duration-200 flex-shrink-0"
                      title="Rescan RFID"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 h-20 flex items-center">
                  <div className="w-full text-center">
                    <p className="text-sm font-medium text-gray-500">Name: -</p>
                    <p className="text-xs text-gray-400">Phone: -</p>
                    <p className="text-xs text-gray-400">Customer ID: -</p>
                  </div>
                </div>
              )}
            </div>

            {/* Staff Info with Integrated Logout Button */}
            {authLoading ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 h-20 flex items-center">
                <div className="w-full">
                  <div className="w-20 h-4 bg-gray-200 rounded animate-pulse mb-1"></div>
                  <div className="w-16 h-3 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            ) : currentUser ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 h-20 flex items-center">
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-black">
                      {currentUser.name}
                    </p>
                    <p className="text-xs text-gray-600">
                      {currentUser.role} • {currentUser.email}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await logout();
                        navigate("/login", { replace: true });
                      } catch (e) {
                        console.error("Logout failed", e);
                      }
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-md transition-colors duration-200 flex-shrink-0"
                    title="Logout"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 h-20 flex items-center">
                <div className="w-full text-center">
                  <p className="text-sm text-gray-500">Not logged in</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
