import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // Add this import
import { useAuth } from "../auth/AuthContext";
import { FiSearch, FiMenu } from "react-icons/fi";
import { adminAPI } from "../services/adminAPI";

export default function Topbar({ onMenuClick }) {
  const navigate = useNavigate(); // Add this hook
  const { logout, user, role, loading: authLoading } = useAuth();

  // Backend-ready states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Get user display information
  const getUserDisplayInfo = () => {
    if (!user) return null;
    
    return {
      id: user.uid,
      name: user.displayName || user.email?.split('@')[0] || 'User',
      email: user.email,
      role: role || 'User',
      avatar: user.photoURL || null,
      isOnline: true, // Always true for current user
      lastLogin: new Date().toISOString(),
    };
  };

  const currentUser = getUserDisplayInfo();

  // Search functionality with debounce
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch(searchQuery);
      } else {
        setShowSearchResults(false);
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  // Handle search (uses Supabase via adminAPI)
  const handleSearch = async (query) => {
    if (!query.trim()) return;

    setSearchLoading(true);
    try {
      const res = await adminAPI.globalSearch(query, 10);
      setSearchResults(res.data);
      setShowSearchResults(true);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle search result click with actual navigation
  const handleSearchResultClick = (result) => {
    console.log("Navigating to:", result);

    // Close search results
    setShowSearchResults(false);
    setSearchQuery("");

    // Navigate based on result type
    const navState = {
      state: {
        focusId: result.id,
        focusType: result.type,
        focusName: result.name,
      },
    };
    if (result.type === "item") {
      navigate("/admin/manage-items", navState);
    } else if (result.type === "customer") {
      navigate("/admin/customers", navState);
    } else if (result.path) {
      navigate(result.path, navState);
    }
  };

  // Loading spinner component
  const LoadingSpinner = () => (
    <div className="animate-spin rounded-full border-b-2 border-red-500 h-4 w-4" />
  );

  return (
    <div className="w-full flex justify-between items-center bg-white px-3 sm:px-5 h-16 border-b border-slate-200 relative">
      {/* Left Section - Menu Button + Brand (lg uses sidebar brand) */}
      <div className="flex items-center gap-3">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <FiMenu size={20} className="text-slate-600" />
        </button>

        {/* Brand (mobile only — sidebar shows it on desktop) */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="h-8 w-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white text-sm">
            K
          </div>
          <span className="font-semibold text-slate-900">Khatape</span>
        </div>
      </div>

      {/* Search Bar with Results - Hidden on mobile */}
      <div className="relative hidden md:block">
        <div className="flex items-center bg-slate-100 rounded-xl px-3 lg:px-4 py-2 w-72 lg:w-96 border border-transparent focus-within:ring-2 focus-within:ring-red-500 focus-within:bg-white transition-all">
          <FiSearch className="text-slate-400 mr-2 lg:mr-3 flex-shrink-0" size={16} />
          <input
            type="text"
            placeholder="Search items, customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() =>
              searchQuery.length >= 2 && setShowSearchResults(true)
            }
            onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
            className="bg-transparent outline-none w-full text-slate-900 placeholder-slate-400 text-sm"
          />
          {searchLoading && (
            <div className="ml-2">
              <LoadingSpinner size="sm" />
            </div>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto z-50">
            {searchResults.map((result) => (
              <div
                key={`${result.type}-${result.id}`}
                className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                onClick={() => handleSearchResultClick(result)}
              >
                <div>
                  <p className="font-medium text-black text-sm">
                    {result.name}
                  </p>
                  <p className="text-xs text-gray-500">{result.category}</p>
                </div>
                <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                  {result.type}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* No Results */}
        {showSearchResults &&
          searchResults.length === 0 &&
          !searchLoading &&
          searchQuery.length >= 2 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 p-4 z-50">
              <p className="text-gray-500 text-sm text-center">
                No results found for "{searchQuery}"
              </p>
            </div>
          )}
      </div>

      {/* Right Section - Profile */}
      <div className="flex items-center pr-2 sm:pr-4">
        {authLoading ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-16 sm:w-24 h-6 sm:h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-8 sm:w-10 h-8 sm:h-10 bg-gray-200 rounded-full animate-pulse"></div>
          </div>
        ) : currentUser ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block text-right leading-tight">
              <p className="text-sm font-semibold text-slate-900">{currentUser.name}</p>
              <p className="text-xs text-slate-400 capitalize">{currentUser.role}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-semibold">
              {currentUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
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
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-600 transition-colors flex-shrink-0"
              title="Sign out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="text-xs sm:text-sm text-slate-400">Not logged in</div>
        )}
      </div>
    </div>
  );
}
