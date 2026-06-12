import { useState, useRef, useEffect, useCallback } from "react";
import { staffAPI } from "../services/staffAPI";
import { whatsappService } from "../services/whatsappService";
import thermalPrinterService from "../services/thermalPrinterService";
import { isModuleOn } from "../services/session";
import { computeLineTotal, quantityForAmount } from "../lib/pricing";
import { rupeesToPaise, paiseToRupees } from "../lib/money";
import { unitFamily, LOOSE_UNITS } from "../lib/units";

// Sale units compatible with a loose item's rate unit (same weight/volume family).
const compatibleUnits = (rateUnit) => {
  try {
    const fam = unitFamily(rateUnit);
    return LOOSE_UNITS.filter((u) => unitFamily(u) === fam);
  } catch {
    return [rateUnit];
  }
};

export default function PointOfSale() {
  // Customer & RFID states
  const [rfidInput, setRfidInput] = useState("");
  const [customer, setCustomer] = useState(null);
  const [showNotRegistered, setShowNotRegistered] = useState(false);
  const [isScanning, setIsScanning] = useState(true);

  // Cart states
  const [cart, setCart] = useState([]);
  const [customItemPrice, setCustomItemPrice] = useState("");
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);

  // Loose-item entry modal (sell by weight/volume or by rupee amount)
  const [looseItem, setLooseItem] = useState(null); // the product being added
  const [looseMode, setLooseMode] = useState("qty"); // 'qty' | 'amount'
  const [looseQty, setLooseQty] = useState("");
  const [looseUnit, setLooseUnit] = useState("");
  const [looseAmount, setLooseAmount] = useState("");
  const [looseError, setLooseError] = useState("");

  // Transaction states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastTransaction, setLastTransaction] = useState(null);

  // Thermal printing is gated by the 'thermal_print' module for this shop.
  const [thermalOn, setThermalOn] = useState(false);

  // Printer states
  const [printerConnected, setPrinterConnected] = useState(false);
  const [printerName, setPrinterName] = useState("");
  const [connectingPrinter, setConnectingPrinter] = useState(false);
  const [printerStatus, setPrinterStatus] = useState(null);

  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Items states
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemTab, setItemTab] = useState("packaged"); // 'packaged' | 'loose'

  // Mobile responsive states
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState('scan');

  // WhatsApp state
  const [whatsappSending, setWhatsappSending] = useState(false);

  // Refs
  const rfidInputRef = useRef(null);
  const customItemInputRef = useRef(null);

  // ==================== LIFECYCLE EFFECTS ====================

  // Load items on mount
  useEffect(() => {
    loadItems();
    isModuleOn("thermal_print")
      .then((on) => {
        setThermalOn(on);
        if (on) checkPrinterConnection();
      })
      .catch(() => setThermalOn(false));
  }, []);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setMobileView('scan');
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Listen for add item events
  useEffect(() => {
    const handleAddFromSearch = (event) => {
      if (customer) {
        handleAddItem(event.detail);
      }
    };

    window.addEventListener("addItemToCart", handleAddFromSearch);
    return () => window.removeEventListener("addItemToCart", handleAddFromSearch);
  }, [customer]);

  // RFID focus management
  useEffect(() => {
    let focusInterval;

    if (isScanning && !loading) {
      const maintainFocus = () => {
        if (rfidInputRef.current && document.activeElement !== rfidInputRef.current) {
          rfidInputRef.current.focus({ preventScroll: true });
        }
      };

      maintainFocus();
      focusInterval = setInterval(maintainFocus, 500);

      const handleDocumentClick = () => {
        if (isScanning && rfidInputRef.current) {
          setTimeout(() => rfidInputRef.current.focus(), 50);
        }
      };

      document.addEventListener('touchend', handleDocumentClick);
      document.addEventListener('click', handleDocumentClick);

      return () => {
        clearInterval(focusInterval);
        document.removeEventListener('touchend', handleDocumentClick);
        document.removeEventListener('click', handleDocumentClick);
      };
    }

    return () => {
      if (focusInterval) clearInterval(focusInterval);
    };
  }, [isScanning, loading]);

  // Update topbar when customer changes
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("customerUpdate", { detail: customer })
    );
  }, [customer]);

  // Listen for rescan events
  useEffect(() => {
    const handleResetToScan = () => {
      resetToScan();
    };

    window.addEventListener("resetToScan", handleResetToScan);
    return () => window.removeEventListener("resetToScan", handleResetToScan);
  }, []);

  // Custom item modal focus
  useEffect(() => {
    if (showCustomItemModal && customItemInputRef.current) {
      const timer = setTimeout(() => {
        if (customItemInputRef.current) {
          customItemInputRef.current.focus();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [showCustomItemModal]);

  // Desktop custom item input focus
  useEffect(() => {
    if (!isMobile && customItemInputRef.current && customItemPrice === "") {
      const timer = setTimeout(() => {
        if (customItemInputRef.current) {
          customItemInputRef.current.focus();
        }
      }, 10);

      return () => clearTimeout(timer);
    }
  }, [customItemPrice, isMobile]);

  // ==================== PRINTER FUNCTIONS ====================

  const checkPrinterConnection = () => {
    const status = thermalPrinterService.getStatus();
    setPrinterConnected(status.isConnected);
    setPrinterName(status.deviceName || "");
  };

  const handleConnectPrinter = async () => {
    setConnectingPrinter(true);
    setError(null);

    try {
      const result = await thermalPrinterService.connectBluetooth();

      if (result.success) {
        setPrinterConnected(true);
        setPrinterName(result.deviceName);
        setError(`✅ Connected to ${result.deviceName}`);
        setTimeout(() => setError(null), 3000);
      } else if (result.cancelled) {
        // User cancelled - do nothing
      } else {
        setError(`❌ Failed to connect: ${result.message}`);
      }
    } catch (error) {
      console.error('Printer connection error:', error);
      setError('❌ Failed to connect to printer');
    } finally {
      setConnectingPrinter(false);
    }
  };

  const handleDisconnectPrinter = async () => {
    try {
      await thermalPrinterService.disconnect();
      setPrinterConnected(false);
      setPrinterName("");
      setError('Printer disconnected');
      setTimeout(() => setError(null), 2000);
    } catch (error) {
      console.error('Disconnect error:', error);
      setError('Failed to disconnect printer');
    }
  };

  // ==================== ITEM FUNCTIONS ====================

  const loadItems = async () => {
    try {
      setItemsLoading(true);
      const response = await staffAPI.getAllItems();
      setItems(response.data);
    } catch (error) {
      console.error("Failed to load items:", error);
      setError("Failed to load items");
    } finally {
      setItemsLoading(false);
    }
  };

  const addToCart = useCallback(
    (item) => {
      if (!customer) return;
      setCart((prevCart) => {
        const existingItem = prevCart.find(
          (cartItem) => cartItem.id === item.id
        );
        if (existingItem) {
          return prevCart.map((cartItem) =>
            cartItem.id === item.id
              ? { ...cartItem, quantity: cartItem.quantity + 1 }
              : cartItem
          );
        }
        return [...prevCart, { ...item, quantity: 1 }];
      });
    },
    [customer]
  );

  const removeFromCart = (itemId) => {
    setCart(cart.filter((cartItem) => cartItem.id !== itemId));
  };

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCart(
      cart.map((cartItem) =>
        cartItem.id === itemId
          ? { ...cartItem, quantity: newQuantity }
          : cartItem
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    setCustomItemPrice("");
  };

  // Route a tapped product: loose items open the weight/amount modal; the rest go straight in.
  const handleAddItem = useCallback(
    (item) => {
      if (!customer) return;
      if (item.pricingMode === "loose") {
        openLooseModal(item);
      } else {
        addToCart(item);
      }
    },
    [customer, addToCart]
  );

  const openLooseModal = (item) => {
    setLooseItem(item);
    setLooseMode("amount"); // default to "₹40 of milk" — the common counter case
    setLooseQty("");
    setLooseAmount("");
    setLooseUnit(item.rateUnit);
    setLooseError("");
  };

  const closeLooseModal = () => {
    setLooseItem(null);
    setLooseError("");
  };

  // Build the priced loose cart line using the tested src/lib pricing core.
  const confirmLooseItem = () => {
    if (!looseItem) return;
    const product = {
      pricingMode: "loose",
      ratePaise: rupeesToPaise(Number(looseItem.price)),
      rateUnit: looseItem.rateUnit,
    };
    try {
      let quantity;
      let totalPaise;
      const saleUnit = looseUnit || looseItem.rateUnit;
      if (looseMode === "amount") {
        const amt = parseFloat(looseAmount);
        if (!amt || amt <= 0) throw new Error("Enter a valid rupee amount");
        const res = quantityForAmount(product, rupeesToPaise(amt), saleUnit);
        quantity = res.quantity;
        totalPaise = res.totalPaise;
      } else {
        quantity = parseFloat(looseQty);
        if (!quantity || quantity <= 0) throw new Error("Enter a valid quantity");
        totalPaise = computeLineTotal(product, quantity, saleUnit);
      }
      const lineTotal = paiseToRupees(totalPaise);
      const line = {
        id: `loose-${looseItem.id}-${cart.length}-${quantity}-${saleUnit}`,
        itemId: looseItem.id,
        name: looseItem.name,
        price: Number(looseItem.price),
        image: looseItem.image,
        pricingMode: "loose",
        rateUnit: looseItem.rateUnit,
        isLoose: true,
        quantity,
        saleUnit,
        lineTotal,
      };
      setCart((prev) => [...prev, line]);
      closeLooseModal();
    } catch (e) {
      setLooseError(e.message || "Could not add item");
    }
  };

  const lineTotalOf = (item) =>
    item.lineTotal != null ? item.lineTotal : item.price * item.quantity;

  const cartTotal = cart.reduce((total, item) => total + lineTotalOf(item), 0);

  // ==================== CUSTOM ITEM FUNCTIONS ====================

  const addCustomItemToCart = () => {
    if (!customItemPrice || parseFloat(customItemPrice) <= 0) {
      setError("Please enter a valid price");
      return;
    }

    const newCustomItem = {
      id: `custom-${Date.now()}`,
      name: "Item",
      price: parseFloat(customItemPrice),
      capacity: "Custom",
      image: null,
      isCustom: true,
      quantity: 1
    };

    setCart(prevCart => [...prevCart, newCustomItem]);
    setCustomItemPrice("");

    if (isMobile) {
      setShowCustomItemModal(false);
    } else {
      setTimeout(() => {
        if (customItemInputRef.current) {
          customItemInputRef.current.focus();
        }
      }, 50);
    }
  };

  const handleCustomItemPriceChange = (e) => {
    setCustomItemPrice(e.target.value);
    setTimeout(() => {
      if (customItemInputRef.current && document.activeElement !== customItemInputRef.current) {
        customItemInputRef.current.focus();
      }
    }, 0);
  };

  const handleCustomItemSubmit = (e) => {
    e.preventDefault();
    addCustomItemToCart();
  };

  // ==================== RFID FUNCTIONS ====================

  const handleRfidInput = (e) => {
    const value = e.target.value;
    const numericValue = value.replace(/[^0-9]/g, '');

    if (numericValue.length < rfidInput.length) {
      e.target.value = rfidInput;
      e.target.focus();
      return;
    }

    setRfidInput(numericValue);

    if (numericValue.length === 10) {
      setTimeout(() => {
        handleRfidSubmit(numericValue);
      }, 100);
    }
  };

  const handleRfidKeyDown = (e) => {
    if (isScanning && ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      if (rfidInputRef.current) {
        rfidInputRef.current.focus({ preventScroll: true });
      }
    }
  };

  const handleRfidFocus = () => {
    if (isScanning && rfidInputRef.current) {
      rfidInputRef.current.style.caretColor = 'transparent';
    }
  };

  const handleRfidBlur = () => {
    if (isScanning && rfidInputRef.current) {
      setTimeout(() => {
        rfidInputRef.current.focus({ preventScroll: true });
      }, 50);
    }
  };

  const handleRfidForm = (e) => {
    e.preventDefault();
    handleRfidSubmit(rfidInput);
  };

  const handleRfidSubmit = async (rfidValue) => {
    if (!rfidValue.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await staffAPI.getCustomerByRfid(rfidValue.trim());
      const foundCustomer = response.data;
      setCustomer(foundCustomer);
      setIsScanning(false);
      setShowNotRegistered(false);

      if (isMobile) {
        setMobileView('items');
      }
    } catch (error) {
      console.error("Customer lookup failed:", error);
      setShowNotRegistered(true);
      setIsScanning(false);
      setCustomer(null);
    } finally {
      setLoading(false);
      setRfidInput("");
    }
  };

  const resetToScan = () => {
    setIsScanning(true);
    setCustomer(null);
    setShowNotRegistered(false);
    setRfidInput("");
    setCart([]);
    setShowSuccessModal(false);
    setLastTransaction(null);
    setError(null);
    setCustomItemPrice("");
    setShowCustomItemModal(false);
    setWhatsappSending(false);
    if (isMobile) {
      setMobileView('scan');
    }
  };

  // ==================== TRANSACTION FUNCTIONS ====================

  const handleCompletePurchase = async () => {
    if (cart.length === 0 || !customer) return;
  
    setLoading(true);
  
    try {
      const transactionData = {
        // Key transactions/invoices by the canonical customer uuid so the
        // ledger/invoice pages (which use customer.id) line up.
        customerId: customer.id,
        customerName: customer.name,
        items: cart.map((item) => ({
          itemId: item.itemId || item.id,
          itemName: item.isLoose ? `${item.name} (${item.quantity} ${item.saleUnit})` : item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          total: lineTotalOf(item),
          pricingMode: item.pricingMode || "packaged",
          saleUnit: item.saleUnit || "piece",
        })),
        total: cartTotal,
        timestamp: new Date().toISOString(),
      };
  
      const response = await staffAPI.createTransaction(transactionData);
  
      const mockTransaction = {
        id: response.data.id,
        customer: customer,
        items: cart,
        total: cartTotal,
        timestamp: new Date(),
      };
  
      setLastTransaction(mockTransaction);
      setShowSuccessModal(true);
      setCart([]);
      setCustomItemPrice("");
      setWhatsappSending(false);
  
      // Print receipt ONLY if printer is connected
      if (thermalOn && printerConnected) {
        setTimeout(async () => {
          try {
            const printResult = await thermalPrinterService.printPurchaseReceipt(mockTransaction);
            
            if (printResult.success) {
              console.log('✅ Receipt printed successfully');
              setPrinterStatus('✅ Printed successfully');
            } else {
              console.error('❌ Print failed:', printResult.message);
              setPrinterStatus(`❌ Print failed`);
              setError(`Print failed: ${printResult.message}`);
            }
            
            setTimeout(() => setPrinterStatus(null), 3000);
          } catch (printError) {
            console.error('Print error:', printError);
            setError('Failed to print receipt');
            setPrinterStatus('❌ Print error');
            setTimeout(() => setPrinterStatus(null), 3000);
          }
        }, 500);
      } else {
        console.log('ℹ️ Printer not connected - Skipping print');
        setPrinterStatus('ℹ️ No printer connected');
        setTimeout(() => setPrinterStatus(null), 3000);
      }
  
      // Send WhatsApp
      setTimeout(() => {
        handleSendWhatsApp(mockTransaction, true);
      }, 1000);
  
    } catch (error) {
      console.error("Transaction failed:", error);
      setError("Failed to complete purchase. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendWhatsApp = async (transaction, isAutomatic = false) => {
    if (!transaction || !transaction.customer) {
      setError("Transaction data not available");
      return;
    }

    setWhatsappSending(true);
    setError(null);

    try {
      const purchaseDetails = {
        customer: transaction.customer,
        items: transaction.items,
        total: transaction.total,
        timestamp: transaction.timestamp,
        transactionId: transaction.id
      };

      const result = whatsappService.sendPurchaseReceipt(
        transaction.customer.phone,
        purchaseDetails
      );

      if (result.success) {
        setError(null);
        if (!isAutomatic) {
          setError("WhatsApp sent successfully!");
          setTimeout(() => setError(null), 3000);
        }
      } else {
        setError(result.message || "Failed to send WhatsApp message");
      }
    } catch (error) {
      console.error("Error sending WhatsApp:", error);
      setError("Failed to send WhatsApp message. Please try again.");
    } finally {
      setWhatsappSending(false);
    }
  };

  const handleMobileViewChange = (view) => {
    setMobileView(view);
  };

  // ==================== UI COMPONENTS ====================

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E54A4A]"></div>
    </div>
  );

  const ErrorMessage = ({ message, onClose }) =>
    message ? (
      <div className="fixed top-20 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50 max-w-sm shadow-lg">
        <span className="block text-sm">{message}</span>
        <button
          onClick={onClose}
          className="absolute top-2 right-2 font-bold text-lg leading-none hover:text-red-900"
        >
          ×
        </button>
      </div>
    ) : null;

  const PrinterStatusBar = ({ connected, printerName, onConnect, onDisconnect, connecting }) => (
    <div className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span className="text-sm font-medium text-gray-700">
                {connected ? `Printer: ${printerName}` : 'Printer: Not Connected'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {connected ? '✅ Ready to print' : '⚠️ Connect Bluetooth printer to print receipts'}
            </p>
          </div>
        </div>

        {connected ? (
          <button
            onClick={onDisconnect}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={connecting}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:bg-gray-400 flex items-center gap-2"
          >
            {connecting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
                Connect Bluetooth Printer
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  const MobileNavBar = ({ currentView, onViewChange, cartCount, customer }) => (
    <div className="bg-white border-b border-gray-200 px-3 py-2 flex justify-between items-center shadow-sm">
      <div className="flex space-x-1">
        <button
          onClick={() => onViewChange('items')}
          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${currentView === 'items'
              ? 'bg-[#E54A4A] text-white shadow-md'
              : 'text-gray-600 hover:text-[#E54A4A] hover:bg-slate-50'
            }`}
        >
          Items
        </button>
        <button
          onClick={() => onViewChange('cart')}
          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors relative ${currentView === 'cart'
              ? 'bg-[#E54A4A] text-white shadow-md'
              : 'text-gray-600 hover:text-[#E54A4A] hover:bg-slate-50'
            }`}
        >
          Cart
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
              {cartCount}
            </span>
          )}
        </button>
        {currentView === 'cart' && customer && (
          <button
            onClick={() => setShowCustomItemModal(true)}
            className="px-3 py-2 rounded-lg text-xs font-semibold transition-colors bg-green-500 text-white hover:bg-green-600"
          >
            + Item
          </button>
        )}
      </div>
      {customer && (
        <div className="text-right">
          <div className="text-xs font-medium text-gray-800 truncate max-w-[120px]">{customer.name}</div>
          <div className="text-xs text-gray-500">Customer</div>
        </div>
      )}
    </div>
  );

  const MobileCartButton = ({ cartCount, total, onToggle, disabled }) => (
    <div className="fixed bottom-3 left-3 right-3 z-40">
      <button
        onClick={onToggle}
        disabled={disabled}
        className="w-full bg-[#E54A4A] hover:bg-[#d63939] text-white py-3 rounded-lg font-semibold transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2 shadow-lg text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01" />
        </svg>
        Cart ({cartCount}) - ₹{total}
      </button>
    </div>
  );

  const CustomItemModal = ({ visible, onClose }) =>
    visible ? (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-6 max-w-sm w-full">
          <h3 className="text-lg font-semibold text-black mb-4">Add Manual Item</h3>
          <form onSubmit={handleCustomItemSubmit}>
            <input
              ref={customItemInputRef}
              type="number"
              placeholder="Enter price"
              value={customItemPrice}
              onChange={handleCustomItemPriceChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E54A4A] mb-2"
              min="0"
              step="0.01"
              autoFocus
              inputMode="decimal"
            />
            <p className="text-xs text-gray-500 mb-4">Item name will be "Item"</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!customItemPrice}
                className="flex-1 bg-[#E54A4A] hover:bg-[#d63939] text-white py-3 rounded-lg font-semibold transition-colors disabled:bg-gray-400"
              >
                Add Item
              </button>
            </div>
          </form>
        </div>
      </div>
    ) : null;

  // Loose-item entry: sell by weight/volume OR by rupee amount (rupee-first).
  const LooseItemModal = () => {
    if (!looseItem) return null;
    const units = compatibleUnits(looseItem.rateUnit);
    const saleUnit = looseUnit || looseItem.rateUnit;

    // Live total preview (never throws into render)
    let preview = "";
    try {
      const product = { pricingMode: "loose", ratePaise: rupeesToPaise(Number(looseItem.price)), rateUnit: looseItem.rateUnit };
      if (looseMode === "amount" && parseFloat(looseAmount) > 0) {
        const r = quantityForAmount(product, rupeesToPaise(parseFloat(looseAmount)), saleUnit);
        preview = `${r.quantity} ${saleUnit} = ₹${paiseToRupees(r.totalPaise).toFixed(2)}`;
      } else if (looseMode === "qty" && parseFloat(looseQty) > 0) {
        const t = computeLineTotal(product, parseFloat(looseQty), saleUnit);
        preview = `${parseFloat(looseQty)} ${saleUnit} = ₹${paiseToRupees(t).toFixed(2)}`;
      }
    } catch {
      preview = "";
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-6 max-w-sm w-full">
          <h3 className="text-lg font-semibold text-black mb-1">{looseItem.name}</h3>
          <p className="text-xs text-gray-500 mb-4">₹{looseItem.price} per {looseItem.rateUnit} · loose</p>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setLooseMode("qty")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${looseMode === "qty" ? "bg-[#E54A4A] text-white" : "bg-slate-50 text-gray-700"}`}
            >
              By weight/volume
            </button>
            <button
              type="button"
              onClick={() => setLooseMode("amount")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${looseMode === "amount" ? "bg-[#E54A4A] text-white" : "bg-slate-50 text-gray-700"}`}
            >
              By amount (₹)
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); confirmLooseItem(); }}>
            {looseMode === "qty" ? (
              <div className="mb-2">
                {/* Quick quantity presets (depend on the chosen unit) */}
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {(saleUnit === "g" || saleUnit === "ml"
                    ? [100, 250, 500, 1000]
                    : [0.5, 1, 1.5, 2]
                  ).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setLooseQty(String(q))}
                      className={`py-2 rounded-lg text-sm font-semibold border transition-colors ${
                        String(q) === looseQty
                          ? "bg-[#E54A4A] text-white border-[#E54A4A]"
                          : "bg-white text-gray-700 border-gray-300 hover:border-[#E54A4A]"
                      }`}
                    >
                      {q} {saleUnit}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder={`Or type quantity in ${saleUnit}`}
                    value={looseQty}
                    onChange={(e) => setLooseQty(e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E54A4A]"
                    min="0"
                    step="any"
                    autoFocus
                    inputMode="decimal"
                  />
                  <select
                    value={saleUnit}
                    onChange={(e) => setLooseUnit(e.target.value)}
                    className="px-3 py-3 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    {units.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="mb-2">
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[10, 20, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setLooseAmount(String(amt))}
                      className={`py-2 rounded-lg text-sm font-semibold border transition-colors ${
                        String(amt) === looseAmount
                          ? "bg-[#E54A4A] text-white border-[#E54A4A]"
                          : "bg-white text-gray-700 border-gray-300 hover:border-[#E54A4A]"
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  placeholder="Or type amount in ₹"
                  value={looseAmount}
                  onChange={(e) => setLooseAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E54A4A]"
                  min="0"
                  step="0.01"
                  autoFocus
                  inputMode="decimal"
                />
              </div>
            )}

            {preview && <p className="text-sm font-medium text-green-700 mb-2">{preview}</p>}
            {looseError && <p className="text-xs text-red-600 mb-2">{looseError}</p>}

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={closeLooseModal}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-[#E54A4A] hover:bg-[#d63939] text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Add to Cart
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const ItemsGrid = ({ items, itemsLoading, onRetry, onAddToCart, canInteract, busy, isMobile = false }) => (
    <div className={`${isMobile ? 'px-3 pb-20' : ''}`}>
      <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-3 gap-4'} ${isMobile ? 'pt-3' : ''}`}>
        {itemsLoading ? (
          <div className={`${isMobile ? 'col-span-2' : 'col-span-3'}`}>
            <LoadingSpinner />
            <p className="text-center text-gray-500">Loading items...</p>
          </div>
        ) : items.length === 0 ? (
          <div className={`${isMobile ? 'col-span-2' : 'col-span-3'} text-center text-gray-500 py-8`}>
            <p>No items available</p>
            <button onClick={onRetry} className="mt-2 text-[#E54A4A] hover:text-[#d63939] text-sm">
              Retry
            </button>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={`bg-white rounded-lg border shadow-sm border-gray-300 h-fit ${isMobile ? 'p-3' : 'p-4'}`}>
              <div className="bg-gray-200 aspect-square rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover rounded-lg"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "flex";
                    }}
                  />
                ) : null}
                <span className="text-gray-500 w-full h-full flex items-center justify-center text-xs" style={{ display: item.image ? "none" : "flex" }}>
                  No Image
                </span>
              </div>
              <h3 className={`font-semibold text-black ${isMobile ? 'text-xs' : 'text-sm'} truncate`}>{item.name}</h3>
              <p className={`text-gray-600 ${isMobile ? 'text-xs' : 'text-sm'} truncate`}>
                {item.pricingMode === "loose" ? (
                  <span className="inline-block bg-amber-100 text-amber-700 px-1.5 rounded text-xs font-medium">Loose · /{item.rateUnit}</span>
                ) : (
                  item.capacity || item.measurement
                )}
              </p>
              <p className={`font-bold text-black ${isMobile ? 'text-sm' : 'text-lg'}`}>
                ₹{item.price}{item.pricingMode === "loose" ? <span className="text-xs font-normal text-gray-500">/{item.rateUnit}</span> : null}
              </p>
              {item.stock !== undefined && (
                <p className="text-xs text-gray-500">Stock: {item.stock}</p>
              )}
              <div
                onClick={() => canInteract && !busy && onAddToCart(item)}
                className={`w-full mt-2 py-2 text-center font-semibold transition-colors duration-200 cursor-pointer ${isMobile ? 'text-xs' : 'text-sm'} ${canInteract && !busy ? "text-[#E54A4A] hover:text-[#d63939]" : "text-gray-400 cursor-not-allowed"
                  }`}
              >
                {busy ? "Processing..." : canInteract ? (item.pricingMode === "loose" ? "Add (weight/₹)" : "Add to Cart") : "Scan RFID First"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const RfidScanner = ({ loading, rfidInputRef, rfidInput, onInputChange, onSubmit }) => (
    <div
      className="flex flex-col items-center justify-center h-full text-center px-4"
      onClick={() => {
        if (rfidInputRef.current && !loading) {
          rfidInputRef.current.focus({ preventScroll: true });
        }
      }}
    >
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
        {loading ? (
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E54A4A]"></div>
        ) : (
          <svg className="w-10 h-10 text-[#E54A4A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        )}
      </div>
      <h3 className="text-lg font-semibold text-black mb-2">
        {loading ? "Verifying Customer..." : "Scan RFID Card"}
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        {loading ? "Please wait..." : "Tap your RFID card on the scanner"}
      </p>
      {!loading && (
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <input
            ref={rfidInputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={rfidInput}
            onChange={onInputChange}
            onKeyDown={handleRfidKeyDown}
            onFocus={handleRfidFocus}
            onBlur={handleRfidBlur}
            placeholder="RFID will appear here..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-black text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#E54A4A] text-sm"
            autoComplete="off"
            disabled={loading}
            autoFocus
            style={{
              caretColor: 'transparent',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              msUserSelect: 'none',
              fontSize: window.innerWidth < 768 ? '16px' : '14px',
              WebkitTouchCallout: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onPaste={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
          />
          <p className="text-xs text-gray-500 mt-2">Try: 1234567890 (test customer)</p>
          <button type="submit" style={{ display: 'none' }} />
        </form>
      )}
    </div>
  );

  const NotRegistered = ({ loading, onScanAnother }) => (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-black mb-2">Customer Not Registered</h3>
      <p className="text-sm text-gray-600 mb-6">Please register with admin first to make purchases</p>
      <button
        onClick={onScanAnother}
        className="bg-[#E54A4A] hover:bg-[#d63939] text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200"
        disabled={loading}
      >
        Scan Another Card
      </button>
    </div>
  );

  const CartItem = ({ item, onUpdateQuantity, busy }) => (
    <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
      <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
        ) : null}
        <div className="w-full h-full flex items-center justify-center" style={{ display: item.image ? "none" : "flex" }}>
          <span className="text-xs text-gray-500">{item.isCustom ? "ITEM" : "IMG"}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-black text-sm truncate">
          {item.name}
          {item.isCustom && <span className="text-xs text-red-600 ml-1">(Manual)</span>}
          {item.isLoose && <span className="text-xs text-amber-600 ml-1">(Loose)</span>}
        </p>
        {item.isLoose ? (
          <p className="text-xs text-gray-600">
            {item.quantity} {item.saleUnit} × ₹{item.price}/{item.rateUnit} = <span className="font-medium">₹{lineTotalOf(item).toFixed(2)}</span>
          </p>
        ) : (
          <p className="text-xs text-gray-600">₹{item.price}</p>
        )}
      </div>
      {item.isLoose ? (
        <button
          onClick={() => removeFromCart(item.id)}
          className="px-2 h-7 bg-red-100 text-red-600 rounded text-xs font-semibold hover:bg-red-200"
          disabled={busy}
        >
          Remove
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
            className="w-6 h-6 bg-gray-200 rounded text-sm hover:bg-gray-300 flex items-center justify-center"
            disabled={busy}
          >
            -
          </button>
          <span className="text-sm font-medium min-w-[20px] text-center">{item.quantity}</span>
          <button
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
            className="w-6 h-6 bg-gray-200 rounded text-sm hover:bg-gray-300 flex items-center justify-center"
            disabled={busy}
          >
            +
          </button>
        </div>
      )}
    </div>
  );

  const CheckoutPanel = ({ cart, onClear, onUpdateQuantity, subtotal, onCheckout, busy, isMobile = false }) => (
    <div className={`h-full flex flex-col ${isMobile ? 'px-3 pb-3' : ''}`}>
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h3 className={`font-semibold text-black ${isMobile ? 'text-base' : 'text-lg'}`}>
          {cart.length} {cart.length === 1 ? "item" : "items"} in cart
        </h3>
        <button
          onClick={onClear}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-semibold transition-colors duration-200"
          disabled={cart.length === 0 || busy}
        >
          Clear
        </button>
      </div>

      {customer && !isMobile && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border flex-shrink-0">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Add Manual Item</h4>
          <form onSubmit={handleCustomItemSubmit} className="flex gap-2">
            <input
              ref={customItemInputRef}
              type="number"
              placeholder="Enter price"
              value={customItemPrice}
              onChange={handleCustomItemPriceChange}
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#E54A4A]"
              min="0"
              step="0.01"
              disabled={busy}
              inputMode="decimal"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!customItemPrice || busy}
              className="px-4 py-2 bg-[#E54A4A] hover:bg-[#d63939] text-white rounded text-sm font-medium transition-colors disabled:bg-gray-400"
            >
              Add
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-1">Item name will be "Item"</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        {cart.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>Cart is empty</p>
            <p className="text-sm">Add items to continue</p>
          </div>
        ) : (
          <div className="space-y-3 pr-2">
            {cart.map((item) => (
              <CartItem key={item.id} item={item} onUpdateQuantity={onUpdateQuantity} busy={busy} />
            ))}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="border-t border-gray-300 pt-4 mt-4 flex-shrink-0">
          <div className="flex justify-between items-center font-semibold text-lg mb-4">
            <span>Subtotal:</span>
            <span>₹{subtotal}</span>
          </div>
          <button
            onClick={onCheckout}
            className="w-full bg-[#E54A4A] hover:bg-[#d63939] text-white py-4 rounded-lg font-semibold transition-colors duration-200 disabled:bg-gray-400 flex items-center justify-center gap-2 shadow-lg"
            disabled={cart.length === 0 || busy}
          >
            {busy ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>Complete Purchase (₹{subtotal})</>
            )}
          </button>
        </div>
      )}
    </div>
  );

  const SuccessModal = ({ visible, transaction, busy, onClose, onNewCustomer }) =>
    visible && transaction ? (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-6 max-w-md w-full">
          <div className="text-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-black">Purchase Successful!</h3>
            <p className="text-sm text-gray-600 mb-2">
              Customer: {transaction.customer.customerId || transaction.customer.id} - {transaction.customer.name}
            </p>
            <p className="text-lg font-bold text-green-600">Total: ₹{transaction.total}</p>
            <p className="text-xs text-gray-500">Transaction ID: {transaction.id}</p>
            {printerStatus && (
              <p className="text-xs text-red-600 mt-2">{printerStatus}</p>
            )}
          </div>
          <div className="space-y-3">
            <button
              onClick={() => handleSendWhatsApp(transaction, false)}
              disabled={whatsappSending}
              className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${whatsappSending ? 'bg-red-400 text-white cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
            >
              {whatsappSending ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Sending WhatsApp...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                  </svg>
                  Send WhatsApp Receipt
                </>
              )}
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-lg font-semibold transition-colors duration-200"
                disabled={busy}
              >
                Close
              </button>
              <button
                onClick={onNewCustomer}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors duration-200"
                disabled={busy}
              >
                New Customer
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : null;

  // Items split by type for the Packaged / Loose tabs (single shared cart).
  const looseCount = items.filter((i) => i.pricingMode === "loose").length;
  const packagedCount = items.length - looseCount;
  const shownItems = items.filter((i) =>
    itemTab === "loose" ? i.pricingMode === "loose" : i.pricingMode !== "loose"
  );

  const renderItemTabs = () => (
    <div className="flex gap-2 mb-3">
      <button
        onClick={() => setItemTab("packaged")}
        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
          itemTab === "packaged" ? "bg-[#E54A4A] text-white" : "bg-slate-50 text-gray-600 hover:bg-gray-200"
        }`}
      >
        Packaged ({packagedCount})
      </button>
      <button
        onClick={() => setItemTab("loose")}
        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
          itemTab === "loose" ? "bg-amber-500 text-white" : "bg-slate-50 text-gray-600 hover:bg-gray-200"
        }`}
      >
        Loose ({looseCount})
      </button>
    </div>
  );

  // ==================== MAIN RENDER ====================

  return (
    <div className="h-full bg-slate-50 flex flex-col">
      {/* Printer Status Bar - only when the thermal_print module is enabled */}
      {thermalOn && (
        <PrinterStatusBar
          connected={printerConnected}
          printerName={printerName}
          onConnect={handleConnectPrinter}
          onDisconnect={handleDisconnectPrinter}
          connecting={connectingPrinter}
        />
      )}

      {/* Error Message */}
      <ErrorMessage message={error} onClose={() => setError(null)} />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {isMobile ? (
          // MOBILE LAYOUT
          <div className="h-full flex flex-col overflow-hidden">
            {customer && !isScanning && !showNotRegistered && (
              <div className="flex-shrink-0">
                <MobileNavBar
                  currentView={mobileView}
                  onViewChange={handleMobileViewChange}
                  cartCount={cart.length}
                  customer={customer}
                />
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-hidden">
              {isScanning && !showNotRegistered && (
                <div className="h-full bg-white overflow-y-auto">
                  <RfidScanner
                    loading={loading}
                    rfidInputRef={rfidInputRef}
                    rfidInput={rfidInput}
                    onInputChange={handleRfidInput}
                    onSubmit={handleRfidForm}
                  />
                </div>
              )}

              {showNotRegistered && (
                <div className="h-full bg-white overflow-y-auto">
                  <NotRegistered loading={loading} onScanAnother={resetToScan} />
                </div>
              )}

              {customer && !isScanning && !showNotRegistered && mobileView === 'items' && (
                <div className="h-full bg-white flex flex-col overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                    <h2 className="text-base font-semibold text-black">Items</h2>
                    <p className="text-xs text-gray-600">Tap items to add to cart</p>
                  </div>
                  <div className="px-3 pt-3 flex-shrink-0">{renderItemTabs()}</div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <ItemsGrid
                      items={shownItems}
                      itemsLoading={itemsLoading}
                      onRetry={loadItems}
                      onAddToCart={handleAddItem}
                      canInteract={Boolean(customer)}
                      busy={loading}
                      isMobile={true}
                    />
                  </div>
                </div>
              )}

              {customer && !isScanning && !showNotRegistered && mobileView === 'cart' && (
                <div className="h-full bg-white flex flex-col overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                    <h2 className="text-base font-semibold text-black">Cart</h2>
                    <p className="text-xs text-gray-600">{cart.length} items selected</p>
                  </div>
                  <div className="flex-1 min-h-0">
                    <CheckoutPanel
                      cart={cart}
                      onClear={clearCart}
                      onUpdateQuantity={updateQuantity}
                      subtotal={cartTotal}
                      onCheckout={handleCompletePurchase}
                      busy={loading}
                      isMobile={true}
                    />
                  </div>
                </div>
              )}
            </div>

            {customer && !isScanning && !showNotRegistered && mobileView === 'items' && cart.length > 0 && (
              <div className="flex-shrink-0">
                <MobileCartButton
                  cartCount={cart.length}
                  total={cartTotal}
                  onToggle={() => handleMobileViewChange('cart')}
                  disabled={loading}
                />
              </div>
            )}
          </div>
        ) : (
          // DESKTOP LAYOUT
          <div className="h-full flex">
            <div className="w-[70%] p-6">
              <div className="bg-white shadow-sm rounded-xl p-4 h-full flex flex-col">
                <h2 className="text-lg font-semibold text-black mb-3">Items</h2>
                {renderItemTabs()}
                <div className="flex-1 overflow-y-auto">
                  <ItemsGrid
                    items={shownItems}
                    itemsLoading={itemsLoading}
                    onRetry={loadItems}
                    onAddToCart={handleAddItem}
                    canInteract={Boolean(customer)}
                    busy={loading}
                    isMobile={false}
                  />
                </div>
              </div>
            </div>

            <div className="w-[30%] p-6 pl-0">
              <div className="bg-white shadow-sm rounded-xl p-4 h-full">
                {isScanning && !showNotRegistered && (
                  <RfidScanner
                    loading={loading}
                    rfidInputRef={rfidInputRef}
                    rfidInput={rfidInput}
                    onInputChange={handleRfidInput}
                    onSubmit={handleRfidForm}
                  />
                )}
                {showNotRegistered && (
                  <NotRegistered loading={loading} onScanAnother={resetToScan} />
                )}
                {customer && !isScanning && !showNotRegistered && (
                  <CheckoutPanel
                    cart={cart}
                    onClear={clearCart}
                    onUpdateQuantity={updateQuantity}
                    subtotal={cartTotal}
                    onCheckout={handleCompletePurchase}
                    busy={loading}
                    isMobile={false}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CustomItemModal
        visible={showCustomItemModal}
        onClose={() => setShowCustomItemModal(false)}
      />

      {LooseItemModal()}

      <SuccessModal
        visible={showSuccessModal}
        transaction={lastTransaction}
        busy={loading}
        onClose={() => setShowSuccessModal(false)}
        onNewCustomer={() => {
          setShowSuccessModal(false);
          resetToScan();
        }}
      />
    </div>
  );
}