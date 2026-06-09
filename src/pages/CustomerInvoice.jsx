import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from 'axios';
import { whatsappService } from '../services/whatsappService'; // Add this import
import { useAuth } from '../auth/AuthContext'; // Make sure this import exists

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  XIcon,
  CalendarIcon,
  DocumentDownloadIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CurrencyRupeeIcon,
} from "@heroicons/react/outline";
import { adminAPI } from "../services/adminAPI";
import jsPDF from 'jspdf';

export default function CustomerInvoice() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { collectionId } = useAuth(); // ADD THIS LINE - get collectionId from auth context

  // Manual WhatsApp sending function
  const sendInvoiceManually = async () => {
    try {
      setSendingInvoice(true);
      setError(null);

      console.log('🚀 Generating invoice manually for WhatsApp...');

      // Generate invoice ID
      const invoiceId = generateCustomInvoiceId(customer.id, startDate, endDate);

      // Create invoice data
      // IMPORTANT: Use invoiceId as the id field since the DB keys invoices by invoiceId
      const invoiceData = {
        id: invoiceId, // Use invoiceId as id to match the stored invoice key
        invoiceId: invoiceId,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        startDate,
        endDate,
        orders: selectedOrders,
        totalAmount: selectedTotalAmount,
        paidAmount: 0,
        remainingAmount: selectedTotalAmount,
        paymentStatus: 'unpaid',
        createdAt: new Date().toISOString(),
        payments: [],
        generatedAt: new Date().toISOString(),
        sentVia: 'manual_whatsapp'
      };

      // Generate beautiful PDF for WhatsApp
      const pdfBase64 = await generateBeautifulPDFForWhatsApp(
        customer,
        selectedOrders,
        startDate,
        endDate,
        selectedTotalAmount,
        invoiceId
      );

      // Save invoice to database first
      const saveResult = await adminAPI.createInvoice(invoiceData);

      // Use the saved invoice data with correct ID from response
      const savedInvoice = saveResult.data || invoiceData;

      // Add to local state with correct ID
      setInvoices((prev) => [savedInvoice, ...prev]);

      // Use WhatsApp service to open WhatsApp
      const whatsappResult = whatsappService.sendInvoiceReceipt(customer.phone, {
        customer: {
          name: customer.name,
          phone: customer.phone
        },
        invoiceId: invoiceId,
        startDate,
        endDate,
        orders: selectedOrders,
        totalAmount: selectedTotalAmount,
        paidAmount: 0,
        remainingAmount: selectedTotalAmount,
        paymentStatus: 'unpaid',
        storeName: "Chamunda Dairy"
      });

      if (whatsappResult.success) {
        // Convert base64 to blob and auto-download PDF
        const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });

        // Auto-download PDF
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Invoice-${invoiceId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setSuccessMessage(
          `✅ WhatsApp opened successfully! PDF downloaded. Please attach the PDF file to WhatsApp chat with ${customer.name}.`
        );
      } else {
        throw new Error(whatsappResult.message || 'Failed to open WhatsApp');
      }

      setShowInvoiceModal(false);
      setTimeout(() => setSuccessMessage(""), 8000);

    } catch (error) {
      console.error('❌ Manual invoice sending error:', error);
      setError(error.message || "Failed to generate invoice manually. Please try again.");
    } finally {
      setSendingInvoice(false);
    }
  };
  // State management
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [activeTab, setActiveTab] = useState("purchase");

  // Overpaid Amount Tracking (Frontend Only)

  const [overpaidAmount, setOverpaidAmount] = useState("");
  const [editingOverpaid, setEditingOverpaid] = useState(false);
  const [tempOverpaidAmount, setTempOverpaidAmount] = useState("");

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [addingPayment, setAddingPayment] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState({});

  // Edit Purchase Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const currentData = activeTab === "purchase" ? orders : invoices;
  const totalPages = Math.ceil(currentData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = currentData.slice(startIndex, startIndex + itemsPerPage);

  // Send invoice via backend
  // CustomerInvoice.jsx - Replace your current sendInvoiceDirectly function
  // REPLACE the entire sendInvoiceDirectly function with:
  const sendInvoiceDirectly = async (invoiceData, pdfBase64) => {
    try {
      // Convert base64 to blob and download PDF
      const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${invoiceData.invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Create WhatsApp message
      const message = `🧾 *PROFESSIONAL INVOICE FROM Chamunda-Dairy*

  *Customer:* ${invoiceData.customerName}
  *Invoice ID:* ${invoiceData.invoiceId}
  *Period:* ${invoiceData.startDate} to ${invoiceData.endDate}

  *Total Amount:* ₹${invoiceData.totalAmount}
  *Remaining:* ₹${invoiceData.remainingAmount || invoiceData.totalAmount}

  📄 *Professional PDF invoice with UPI QR code has been downloaded*
  💳 *Scan QR code in PDF for instant payment*

  Please attach the downloaded PDF file to this chat.

  Thank you for your business!
  `;

      // Clean phone number and create WhatsApp link
      const phoneNumber = invoiceData.customerPhone.replace(/[^0-9]/g, '');
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

      // Open WhatsApp
      window.open(whatsappUrl, '_blank');

      return {
        success: true,
        method: 'download_and_whatsapp_link'
      };

    } catch (error) {
      console.error('❌ Error:', error);
      throw error;
    }
  };

  // Load overpaid amount from localStorage
  useEffect(() => {
    if (customerId) {
      const savedAmount = localStorage.getItem(`overpaid_${customerId}`);
      if (savedAmount) {
        setOverpaidAmount(savedAmount);
      }
    }
  }, [customerId]);

  // Save overpaid amount to localStorage
  const saveOverpaidAmount = (amount) => {
    if (amount && amount.trim() !== "" && !isNaN(parseFloat(amount))) {
      localStorage.setItem(`overpaid_${customerId}`, amount);
      setOverpaidAmount(amount);
    } else {
      localStorage.removeItem(`overpaid_${customerId}`);
      setOverpaidAmount("");
    }
  };

  // Handle overpaid amount input
  const handleOverpaidAmountChange = (e) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setTempOverpaidAmount(value);
    }
  };

  // Start editing overpaid amount
  const startEditingOverpaid = () => {
    setEditingOverpaid(true);
    setTempOverpaidAmount(overpaidAmount);
  };

  // Save overpaid amount
  const saveOverpaidEdit = () => {
    saveOverpaidAmount(tempOverpaidAmount);
    setEditingOverpaid(false);
    setTempOverpaidAmount("");
  };

  // Cancel editing overpaid amount
  const cancelOverpaidEdit = () => {
    setEditingOverpaid(false);
    setTempOverpaidAmount("");
  };

  // Remove overpaid amount
  const removeOverpaidAmount = () => {
    saveOverpaidAmount("");
    setEditingOverpaid(false);
    setTempOverpaidAmount("");
  };

  // Handle keyboard events for overpaid amount
  const handleOverpaidKeyDown = (e) => {
    if (e.key === "Enter") {
      saveOverpaidEdit();
    } else if (e.key === "Escape") {
      cancelOverpaidEdit();
    }
  };

  // Fetch customer data and orders
  useEffect(() => {
    loadCustomerData();
  }, [customerId]);

  // Load customer data
  const loadCustomerData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [customerResponse, ordersResponse, invoicesResponse] = await Promise.all([
        adminAPI.getCustomerById(customerId),
        adminAPI.getCustomerOrders(customerId),
        adminAPI.getCustomerInvoices(customerId),
      ]);

      setCustomer(customerResponse.data);
      setOrders(ordersResponse.data.orders);

      const processedInvoices = (invoicesResponse.data.invoices || []).map(invoice => {
        // Normalize invoice ID: if invoiceId exists and id doesn't match, use invoiceId as id
        // This ensures consistency with how invoices are saved (using invoiceId as document ID)
        const normalizedId = invoice.invoiceId && invoice.id !== invoice.invoiceId
          ? invoice.invoiceId
          : invoice.id;

        return {
          ...invoice,
          id: normalizedId, // Ensure id matches invoiceId for consistency
          paidAmount: invoice.paidAmount || 0,
          remainingAmount: invoice.remainingAmount !== undefined
            ? invoice.remainingAmount
            : invoice.totalAmount - (invoice.paidAmount || 0),
          payments: invoice.payments || [],
          paymentStatus: calculatePaymentStatus(
            invoice.totalAmount,
            invoice.paidAmount || 0
          )
        };
      });

      setInvoices(processedInvoices);
    } catch (error) {
      setError(error.message || "Failed to load customer data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Calculate payment status based on amounts
  const calculatePaymentStatus = (totalAmount, paidAmount) => {
    if (paidAmount >= totalAmount) return "paid";
    if (paidAmount > 0) return "partial";
    return "unpaid";
  };

  // Get status badge styling
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "partial":
        return "bg-orange-100 text-orange-800";
      case "unpaid":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  // CustomerInvoice.jsx - Add this function at the top of your component
  const generateBeautifulPDFForWhatsApp = async (customer, selectedOrders, startDate, endDate, selectedTotalAmount, invoiceId) => {
    const [{ default: jsPDF }, autoTableModule, QRCode] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
      import("qrcode")
    ]);

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const autoTable = autoTableModule?.default || autoTableModule?.autoTable;
    const margin = 50;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;

    // Fixed currency function
    const currency = (n) => `Rs ${Number(n || 0).toFixed(2)}`;

    // UPI Configuration
    const UPI_CONFIG = {
      upiId: "9714290103-3@okbizaxis",
      merchantName: "R-Dairy",
      merchantCode: "1234",
    };

    // Generate UPI payment URL
    const generateUPIUrl = (amount, transactionNote) => {
      const upiParams = new URLSearchParams({
        pa: UPI_CONFIG.upiId,
        pn: UPI_CONFIG.merchantName,
        am: amount.toFixed(2),
        cu: "INR",
        tn: transactionNote,
      });
      return `upi://pay?${upiParams.toString()}`;
    };

    // Generate QR Code
    const generateQRCode = async (amount, invoiceId) => {
      try {
        const transactionNote = `Invoice ${invoiceId}`;
        const upiUrl = generateUPIUrl(amount, transactionNote);

        const qrCodeDataURL = await QRCode.toDataURL(upiUrl, {
          width: 120,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        return qrCodeDataURL;
      } catch (error) {
        return null;
      }
    };

    // All your existing PDF generation code from exportToPDF function...
    // (Copy everything from drawHeader, drawFooter, table generation, etc.)

    const drawHeader = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Chamunda Dairy", pageWidth / 2, margin, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`${customer?.name || ""}`, pageWidth / 2, margin + 18, {
        align: "center",
      });
      doc.text(
        `Date Range: ${startDate} to ${endDate}`,
        pageWidth / 2,
        margin + 34,
        { align: "center" }
      );

      // Customer + Summary boxes
      const boxTop = margin + 52;
      const boxHeight = 70;

      // Customer box
      doc.setDrawColor(220);
      doc.setLineWidth(1);
      doc.roundedRect(margin, boxTop, contentWidth / 2 - 8, boxHeight, 6, 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Customer Details", margin + 10, boxTop + 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Name: ${customer?.name || ""}`, margin + 10, boxTop + 36);
      doc.text(`Phone: ${customer?.phone || ""}`, margin + 10, boxTop + 52);
      doc.text(`Customer ID: ${String(customer?.id || "").padStart(4, "0")}`, margin + 10, boxTop + 68);

      // Summary box
      const rightBoxX = margin + contentWidth / 2 + 8;
      doc.roundedRect(rightBoxX, boxTop, contentWidth / 2 - 8, boxHeight, 6, 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Invoice Summary", rightBoxX + 10, boxTop + 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Total Orders: ${selectedOrders.length}`, rightBoxX + 10, boxTop + 36);
      doc.text(`Total Amount: ${currency(selectedTotalAmount)}`, rightBoxX + 10, boxTop + 52);
      doc.text(`Generated: ${new Date().toLocaleString()}`, rightBoxX + 10, boxTop + 68);
    };

    const drawFooter = (pageNum, totalPages) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 16, { align: "center" });
      doc.text("Generated by Chamunda-Dairy System", pageWidth / 2, pageHeight - 30, { align: "center" });
      doc.setTextColor(0);
    };

    // Generate the PDF
    drawHeader();

    // Build table rows
    const rows = selectedOrders.map((order) => {
      const unitPrice = typeof order.unitPrice === "string" ? parseFloat(order.unitPrice) : order.unitPrice;
      const total = typeof order.total === "string" ? parseFloat(order.total) : order.total;
      return [
        String(order.itemName || ""),
        String(order.date || ""),
        String(order.quantity || 0),
        currency(isNaN(unitPrice) ? 0 : unitPrice),
        currency(isNaN(total) ? 0 : total),
      ];
    });

    const startY = margin + 52 + 70 + 24;

    autoTable(doc, {
      head: [["Item Name", "Date", "Qty", "Unit Price", "Total"]],
      body: rows,
      startY,
      margin: { left: margin, right: margin },
      styles: {
        font: "helvetica",
        fontSize: 10,
        cellPadding: 6,
        lineColor: 230,
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        halign: "center",
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: contentWidth - (90 + 40 + 90 + 90) },
        1: { cellWidth: 90, halign: "center" },
        2: { cellWidth: 40, halign: "center" },
        3: { cellWidth: 90, halign: "right" },
        4: { cellWidth: 90, halign: "right" },
      },
      didDrawPage: (data) => {
        // Only draw footer on additional pages, not header
        drawFooter(data.pageNumber, doc.internal.getNumberOfPages());
      },
    });

    const tableEndY = doc.lastAutoTable.finalY || startY;

    // Payment section with UPI QR code
    const paymentSectionHeight = 200;
    const spaceRemaining = pageHeight - margin - tableEndY;

    let paymentSectionY;

    if (spaceRemaining < paymentSectionHeight) {
      doc.addPage();
      paymentSectionY = margin + 50;
    } else {
      paymentSectionY = tableEndY + 30;
    }

    // Left side - Totals
    const totalLabel = "Grand Total:";
    const totalValue = currency(selectedTotalAmount);

    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(2);
    doc.roundedRect(margin, paymentSectionY, 250, 40, 6, 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text(totalLabel, margin + 10, paymentSectionY + 20);
    doc.text(totalValue, margin + 240, paymentSectionY + 20, { align: "right" });
    doc.setTextColor(0);

    // Right side - UPI QR Code
    const qrCodeX = margin + 300;
    const qrCodeY = paymentSectionY - 20;

    // Generate QR code
    const qrCodeDataURL = await generateQRCode(selectedTotalAmount, invoiceId);

    if (qrCodeDataURL) {
      doc.setDrawColor(0, 150, 0);
      doc.setLineWidth(2);
      doc.roundedRect(qrCodeX, qrCodeY, 140, 140, 6, 6);
      doc.addImage(qrCodeDataURL, 'PNG', qrCodeX + 10, qrCodeY + 10, 120, 120);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 150, 0);
      doc.text("Pay via UPI", qrCodeX + 70, qrCodeY + 155, { align: "center" });
      doc.text("Scan QR Code", qrCodeX + 70, qrCodeY + 170, { align: "center" });
      doc.setTextColor(0);
    }

    // Payment instructions
    const instructionsY = paymentSectionY + 70;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);

    doc.text("Payment Instructions:", margin, instructionsY);
    doc.text("1. Scan the QR code with any UPI app (PhonePe, GPay, Paytm, etc.)", margin, instructionsY + 15);
    doc.text("2. Verify the amount and merchant name", margin, instructionsY + 30);
    doc.text("3. Complete the payment", margin, instructionsY + 45);
    doc.text(`4. UPI ID: ${UPI_CONFIG.upiId}`, margin, instructionsY + 60);
    doc.setTextColor(0);

    // Return PDF as base64 for WhatsApp
    return doc.output('datauristring').split(',')[1];
  };

  // Check if purchase can be edited
  const canEditPurchase = (purchase) => {
    // const purchaseTime = new Date(purchase.date).getTime();
    // const now = new Date().getTime();
    // const timeDiff = now - purchaseTime;
    // const hoursDiff = timeDiff / (1000 * 60 * 60);

    // if (hoursDiff > 24) return { canEdit: false, reason: "Edit time limit exceeded (24 hours)" };

    const isInInvoice = invoices.some(invoice =>
      invoice.orders && invoice.orders.some(order => order.id === purchase.id)
    );

    if (isInInvoice) return { canEdit: false, reason: "Purchase is part of a generated invoice" };

    return { canEdit: true };
  };

  const openEditModal = (purchase) => {
    const editCheck = canEditPurchase(purchase);
    if (!editCheck.canEdit) {
      setError(editCheck.reason);
      return;
    }

    setSelectedPurchase(purchase);
    setEditQuantity(purchase.quantity.toString());
    setShowEditModal(true);
    setError(null);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedPurchase(null);
    setEditQuantity("");
    setError(null);
  };

  const handleQuantityChange = (e) => {
    const value = e.target.value;
    if (value === "" || (/^\d+$/.test(value) && parseInt(value) > 0)) {
      setEditQuantity(value);
    }
  };

  const updatePurchase = async () => {
    if (!editQuantity || parseInt(editQuantity) <= 0) {
      setError("Please enter a valid quantity");
      return;
    }

    try {
      setIsUpdating(true);
      setError(null);

      const newQuantity = parseInt(editQuantity);
      const newTotal = selectedPurchase.unitPrice * newQuantity;

      const updatedPurchase = {
        ...selectedPurchase,
        quantity: newQuantity,
        total: newTotal,
        isEdited: true,
        editedAt: new Date().toISOString(),
      };

      await adminAPI.updatePurchase(selectedPurchase.id, updatedPurchase);

      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === selectedPurchase.id ? updatedPurchase : order
        )
      );

      setSuccessMessage(`Purchase updated successfully! Quantity changed to ${newQuantity}`);
      closeEditModal();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setError(error.message || "Failed to update purchase. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const deletePurchase = async () => {
    if (!window.confirm("Are you sure you want to delete this purchase? This action cannot be undone.")) {
      return;
    }

    try {
      setIsUpdating(true);
      setError(null);

      console.log('🔍 Deleting purchase:', selectedPurchase);

      // ✅ The ID is already properly formatted from getCustomerOrders
      // Format: "transactionId-itemId" or "transactionId-custom-timestamp"
      const purchaseIdToDelete = selectedPurchase.id;

      if (!purchaseIdToDelete || !purchaseIdToDelete.includes('-')) {
        throw new Error("Invalid purchase ID format. Please refresh and try again.");
      }

      console.log('🗑️ Deleting with ID:', purchaseIdToDelete);

      await adminAPI.deletePurchase(purchaseIdToDelete);

      // Remove from local state
      setOrders(prevOrders =>
        prevOrders.filter(order => order.id !== selectedPurchase.id)
      );

      setSuccessMessage("Purchase deleted successfully!");
      closeEditModal();
      setTimeout(() => setSuccessMessage(""), 3000);

    } catch (error) {
      console.error('❌ Delete error:', error);
      setError(error.message || "Failed to delete purchase. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const goToPage = (page) => {
    setCurrentPage(page);
  };

  const handleCustomInvoice = () => {
    setShowInvoiceModal(true);
    setError(null);

    const today = new Date();
    let periodStart, periodEnd;

    if (today.getDate() === 1) {
      periodEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);
    } else {
      periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
      periodEnd = today;
    }

    const toISO = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    setStartDate(toISO(periodStart));
    setEndDate(toISO(periodEnd));
  };

  const filterOrdersByDateRange = () => {
    if (!startDate || !endDate) return [];

    return orders.filter((order) => {
      const orderDate = new Date(order.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return orderDate >= start && orderDate <= end;
    });
  };

  const handleDateRangeChange = () => {
    const filteredOrders = filterOrdersByDateRange();
    setSelectedOrders(filteredOrders);
  };

  useEffect(() => {
    if (startDate && endDate) {
      handleDateRangeChange();
    }
  }, [startDate, endDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const generateCustomInvoiceId = (customerId, startDate, endDate) => {
    try {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);

      const startDay = String(startDateObj.getDate()).padStart(2, '0');
      const startMonth = String(startDateObj.getMonth() + 1).padStart(2, '0');
      const endDay = String(endDateObj.getDate()).padStart(2, '0');
      const endMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');

      const startYear = startDateObj.getFullYear();
      const endYear = endDateObj.getFullYear();

      let startDatePart, endDatePart;

      if (startYear !== endYear) {
        const startYearShort = String(startYear).slice(-2);
        const endYearShort = String(endYear).slice(-2);
        startDatePart = `${startDay}${startMonth}${startYearShort}`;
        endDatePart = `${endDay}${endMonth}${endYearShort}`;
      } else {
        startDatePart = `${startDay}${startMonth}`;
        endDatePart = `${endDay}${endMonth}`;
      }

      const invoiceId = `INV-${customerId}-${startDatePart}-${endDatePart}`;
      return invoiceId;

    } catch (error) {
      return `INV-${Date.now()}-${customerId}`;
    }
  };

  // Generate PDF using jsPDF
  const generateInvoicePDF = (invoiceData) => {
    const pdf = new jsPDF();

    // Header
    pdf.setFontSize(20);
    pdf.setFont(undefined, 'bold');
    pdf.text('Chamunda Dairy', 105, 20, { align: 'center' });

    pdf.setFontSize(16);
    pdf.text('Chamunda Dairy', 105, 30, { align: 'center' });

    pdf.setFontSize(12);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Invoice ID: ${invoiceData.invoiceId}`, 105, 40, { align: 'center' });

    // Customer Details
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text('Bill To:', 20, 60);

    pdf.setFontSize(12);
    pdf.setFont(undefined, 'normal');
    pdf.text(invoiceData.customerName, 20, 70);
    pdf.text(`Phone: ${invoiceData.customerPhone}`, 20, 80);
    pdf.text(`Customer ID: ${invoiceData.customerId}`, 20, 90);

    // Invoice Details
    pdf.setFontSize(12);
    pdf.text(`Period: ${invoiceData.startDate} to ${invoiceData.endDate}`, 120, 70);
    pdf.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 120, 80);
    pdf.text(`Total Items: ${invoiceData.orders.length}`, 120, 90);

    // Table Header
    let yPosition = 110;
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'bold');
    pdf.text('Item Name', 20, yPosition);
    pdf.text('Qty', 80, yPosition);
    pdf.text('Unit Price', 100, yPosition);
    pdf.text('Total', 130, yPosition);

    // Table Border
    pdf.line(20, yPosition + 2, 150, yPosition + 2);

    // Table Content
    yPosition += 10;
    pdf.setFont(undefined, 'normal');

    invoiceData.orders.forEach((order, index) => {
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.text(order.itemName.substring(0, 20), 20, yPosition);
      pdf.text(order.quantity.toString(), 80, yPosition);
      pdf.text(`₹${order.unitPrice.toFixed(2)}`, 100, yPosition);
      pdf.text(`₹${order.total.toFixed(2)}`, 130, yPosition);
      yPosition += 8;
    });

    // Total Section
    yPosition += 10;
    pdf.line(20, yPosition, 150, yPosition);
    yPosition += 10;

    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(12);
    pdf.text(`Total Amount: ₹${invoiceData.totalAmount.toFixed(2)}`, 20, yPosition);
    yPosition += 8;
    pdf.text(`Paid Amount: ₹${(invoiceData.paidAmount || 0).toFixed(2)}`, 20, yPosition);
    yPosition += 8;
    pdf.setTextColor(220, 20, 20);
    pdf.text(`Remaining: ₹${(invoiceData.remainingAmount || invoiceData.totalAmount).toFixed(2)}`, 20, yPosition);

    // Footer
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text('Thank you for your business!', 105, yPosition + 20, { align: 'center' });
    pdf.text('For any queries, please contact us.', 105, yPosition + 30, { align: 'center' });

    return pdf;
  };

  // Send invoice function
  // CustomerInvoice.jsx - Replace your current sendInvoice function
  // REPLACE the sendInvoice function with:
  // Replace your current sendInvoice function in CustomerInvoice.jsx
  // Replace the sendInvoice function in CustomerInvoice.jsx
  const sendInvoice = async () => {
    try {
      setSendingInvoice(true);
      setError(null);

      // Check if collectionId is available
      if (!collectionId) {
        throw new Error('Collection ID not available. Please ensure you are logged in.');
      }

      console.log('🚀 Sending custom invoice via HTTP...');
      console.log('Using collectionId:', collectionId);

      // Use the correct function name: sendCustomInvoiceHTTP
      const response = await fetch('https://us-central1-dairy-69.cloudfunctions.net/sendCustomInvoiceHTTP', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionId: collectionId,
          customerId: customer.id,
          startDate,
          endDate
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ HTTP response:', result);

      if (result.success) {
        const newInvoice = result.invoiceData;
        setInvoices((prev) => [newInvoice, ...prev]);

        setSuccessMessage(
          `🎉 Professional invoice sent via WhatsApp! Check ${customer.name}'s phone for the PDF.`
        );
        setShowInvoiceModal(false);
        setTimeout(() => setSuccessMessage(""), 5000);
      } else {
        throw new Error(result.error || 'Failed to send invoice');
      }

    } catch (error) {
      console.error('❌ Invoice sending error:', error);
      setError(error.message || "Failed to send invoice. Please try again.");
    } finally {
      setSendingInvoice(false);
    }
  };

  // ... rest of your component code


  const closeModal = () => {
    setShowInvoiceModal(false);
    setError(null);
    setSelectedOrders([]);
    setStartDate("");
    setEndDate("");
  };

  const openPaymentModal = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentAmount("");
    setPaymentMethod("cash");
    setPaymentNotes("");
    setShowPaymentModal(true);
    setError(null);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedInvoice(null);
    setPaymentAmount("");
    setPaymentMethod("cash");
    setPaymentNotes("");
    setError(null);
  };

  const handlePaymentAmountChange = (e) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setPaymentAmount(value);
    }
  };

  const validatePaymentAmount = () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid payment amount");
      return false;
    }
    if (amount > selectedInvoice.remainingAmount) {
      setError(`Payment amount cannot exceed remaining amount of ₹${selectedInvoice.remainingAmount}`);
      return false;
    }
    return true;
  };

  const addPayment = async () => {
    if (!validatePaymentAmount()) return;

    try {
      setAddingPayment(true);
      setError(null);

      const paymentAmountNum = parseFloat(paymentAmount);
      const newPaidAmount = (selectedInvoice.paidAmount || 0) + paymentAmountNum;
      const newRemainingAmount = selectedInvoice.totalAmount - newPaidAmount;
      const newPaymentStatus = calculatePaymentStatus(selectedInvoice.totalAmount, newPaidAmount);

      // Single source of truth: record into the payments ledger, TARGETED to this
      // invoice. Invoice paid/remaining + the customer-row due are both derived
      // from this ledger, so there's no duplication.
      const invoiceDocumentId = selectedInvoice.invoiceId || selectedInvoice.id;
      if (!invoiceDocumentId) {
        throw new Error("Invoice ID not found. Please refresh the page and try again.");
      }

      await adminAPI.recordPayment({
        customerId: customer.id,
        amount: paymentAmountNum,
        method: paymentMethod,
        note: paymentNotes.trim() || null,
        invoiceId: invoiceDocumentId,
      });

      // Re-derive everything from the ledger (invoices + statuses refresh).
      await loadCustomerData();

      // ✅ NEW: Send WhatsApp payment confirmation
      // Use invoiceId or fall back to id if invoiceId is not available
      const invoiceIdForWhatsApp = selectedInvoice.invoiceId || selectedInvoice.id || invoiceDocumentId;
      const whatsappResult = whatsappService.sendPaymentConfirmation(customer.phone, {
        customer: {
          name: customer.name,
          phone: customer.phone
        },
        invoiceId: invoiceIdForWhatsApp,
        paymentAmount: paymentAmountNum,
        totalAmount: selectedInvoice.totalAmount,
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        paymentMethod: paymentMethod,
        paymentStatus: newPaymentStatus,
        storeName: "Chamunda Dairy" // Change this to your store name
      });

      // Close modal first
      closePaymentModal();

      // Show appropriate success message
      if (whatsappResult.success) {
        setSuccessMessage(
          `✅ Payment of ₹${paymentAmountNum} added successfully! WhatsApp confirmation opened. ${newPaymentStatus === "paid"
            ? "🎉 Invoice is now fully paid!"
            : `₹${newRemainingAmount.toFixed(2)} remaining.`
          }`
        );
      } else {
        // Payment was added but WhatsApp failed to open
        setSuccessMessage(
          `✅ Payment of ₹${paymentAmountNum} added successfully! ${newPaymentStatus === "paid"
            ? "🎉 Invoice is now fully paid!"
            : `₹${newRemainingAmount.toFixed(2)} remaining.`
          } (⚠️ Could not open WhatsApp automatically)`
        );
      }

      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      setError(error.message || "Failed to add payment. Please try again.");
    } finally {
      setAddingPayment(false);
    }
  };

  const togglePaymentHistory = (invoiceId) => {
    setShowPaymentHistory(prev => ({
      ...prev,
      [invoiceId]: !prev[invoiceId]
    }));
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
          className={`animate-spin rounded-full border-b-2 border-blue-500 ${sizeClasses[size]}`}
        ></div>
      </div>
    );
  };

  const totalAmount = orders.reduce((sum, order) => sum + order.total, 0);
  const selectedTotalAmount = selectedOrders.reduce(
    (sum, order) => sum + order.total,
    0
  );

  const totalUnpaidAmount = invoices
    .reduce((sum, invoice) => sum + (invoice.remainingAmount || 0), 0);

  // PDF Export function
  const exportToPDF = () => {
    if (selectedOrders.length === 0) return;
    Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
      import("qrcode")
    ])
      .then(([{ default: jsPDF }, autoTableModule, QRCode]) => {
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        const autoTable = autoTableModule?.default || autoTableModule?.autoTable;
        const margin = 50;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const contentWidth = pageWidth - margin * 2;

        // Fixed currency function
        const currency = (n) => `Rs ${Number(n || 0).toFixed(2)}`;

        // UPI Configuration
        const UPI_CONFIG = {
          upiId: "9714290103-3@okbizaxis",
          merchantName: "Amul Store",
          merchantCode: "1234",
        };

        // Generate UPI payment URL
        const generateUPIUrl = (amount, transactionNote) => {
          const upiParams = new URLSearchParams({
            pa: UPI_CONFIG.upiId,
            pn: UPI_CONFIG.merchantName,
            am: amount.toFixed(2),
            cu: "INR",
            tn: transactionNote,
          });
          return `upi://pay?${upiParams.toString()}`;
        };

        // Generate QR Code
        const generateQRCode = async (amount, invoiceId) => {
          try {
            const transactionNote = `Invoice ${invoiceId} `;
            const upiUrl = generateUPIUrl(amount, transactionNote);

            const qrCodeDataURL = await QRCode.toDataURL(upiUrl, {
              width: 120,
              margin: 1,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });

            return qrCodeDataURL;
          } catch (error) {
            // console.error('Error generating QR code:', error);
            return null;
          }
        };

        // All your existing PDF generation code here...
        // (keeping it the same but removing WhatsApp parts)

        const drawHeader = () => {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(18);
          doc.text("Chamunda Dairy", pageWidth / 2, margin, { align: "center" });

          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          doc.text(`${customer?.name || ""}`, pageWidth / 2, margin + 18, {
            align: "center",
          });
          doc.text(
            `Date Range: ${startDate} to ${endDate}`,
            pageWidth / 2,
            margin + 34,
            { align: "center" }
          );

          // Customer + Summary boxes
          const boxTop = margin + 52;
          const boxHeight = 70;

          // Customer box
          doc.setDrawColor(220);
          doc.setLineWidth(1);
          doc.roundedRect(margin, boxTop, contentWidth / 2 - 8, boxHeight, 6, 6);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.text("Customer Details", margin + 10, boxTop + 18);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          doc.text(`Name: ${customer?.name || ""}`, margin + 10, boxTop + 36);
          doc.text(`Phone: ${customer?.phone || ""}`, margin + 10, boxTop + 52);
          doc.text(`Customer ID: ${String(customer?.id || "").padStart(4, "0")}`, margin + 10, boxTop + 68);

          // Summary box
          const rightBoxX = margin + contentWidth / 2 + 8;
          doc.roundedRect(rightBoxX, boxTop, contentWidth / 2 - 8, boxHeight, 6, 6);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.text("Invoice Summary", rightBoxX + 10, boxTop + 18);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          doc.text(`Total Orders: ${selectedOrders.length}`, rightBoxX + 10, boxTop + 36);
          doc.text(`Total Amount: ${currency(selectedTotalAmount)}`, rightBoxX + 10, boxTop + 52);
          doc.text(`Generated: ${new Date().toLocaleString()}`, rightBoxX + 10, boxTop + 68);
        };

        const drawFooter = (pageNum, totalPages) => {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(120);
          doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 16, { align: "center" });
          doc.text("Generated by Amul Store POS System", pageWidth / 2, pageHeight - 30, { align: "center" });
          doc.setTextColor(0);
        };

        // Main PDF generation function
        const generatePDF = async () => {
          drawHeader();

          // Build table rows
          const rows = selectedOrders.map((order) => {
            const unitPrice = typeof order.unitPrice === "string" ? parseFloat(order.unitPrice) : order.unitPrice;
            const total = typeof order.total === "string" ? parseFloat(order.total) : order.total;
            return [
              String(order.itemName || ""),
              String(order.date || ""),
              String(order.quantity || 0),
              currency(isNaN(unitPrice) ? 0 : unitPrice),
              currency(isNaN(total) ? 0 : total),
            ];
          });

          const startY = margin + 52 + 70 + 24;

          if (!autoTable) {
            throw new Error("jspdf-autotable not loaded correctly");
          }

          autoTable(doc, {
            head: [["Item Name", "Date", "Qty", "Unit Price", "Total"]],
            body: rows,
            startY,
            margin: { left: margin, right: margin },
            styles: {
              font: "helvetica",
              fontSize: 10,
              cellPadding: 6,
              lineColor: 230,
              lineWidth: 0.5,
            },
            headStyles: {
              fillColor: [37, 99, 235],
              textColor: 255,
              halign: "center",
              fontStyle: "bold",
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
              0: { cellWidth: contentWidth - (90 + 40 + 90 + 90) },
              1: { cellWidth: 90, halign: "center" },
              2: { cellWidth: 40, halign: "center" },
              3: { cellWidth: 90, halign: "right" },
              4: { cellWidth: 90, halign: "right" },
            },
            didDrawPage: (data) => {
              // Only draw footer on additional pages, not header
              drawFooter(data.pageNumber, doc.internal.getNumberOfPages());
            },
          });

          const tableEndY = doc.lastAutoTable.finalY || startY;

          // Payment section with QR code
          const paymentSectionY = Math.min(tableEndY + 30, pageHeight - margin - 200);

          // Left side - Totals
          const totalLabel = "Grand Total:";
          const totalValue = currency(selectedTotalAmount);

          doc.setDrawColor(37, 99, 235);
          doc.setLineWidth(2);
          doc.roundedRect(margin, paymentSectionY, 250, 40, 6, 6);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.setTextColor(37, 99, 235);
          doc.text(totalLabel, margin + 10, paymentSectionY + 20);
          doc.text(totalValue, margin + 240, paymentSectionY + 20, { align: "right" });
          doc.setTextColor(0);

          // Right side - UPI QR Code
          const qrCodeX = margin + 300;
          const qrCodeY = paymentSectionY - 20;

          // Generate QR code
          const invoiceId = `INV-${Date.now()}`;
          const qrCodeDataURL = await generateQRCode(selectedTotalAmount, invoiceId);

          if (qrCodeDataURL) {
            doc.setDrawColor(0, 150, 0);
            doc.setLineWidth(2);
            doc.roundedRect(qrCodeX, qrCodeY, 140, 140, 6, 6);
            doc.addImage(qrCodeDataURL, 'PNG', qrCodeX + 10, qrCodeY + 10, 120, 120);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(0, 150, 0);
            doc.text("Pay via UPI", qrCodeX + 70, qrCodeY + 155, { align: "center" });
            doc.text("Scan QR Code", qrCodeX + 70, qrCodeY + 170, { align: "center" });
            doc.setTextColor(0);
          }

          // Payment instructions
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(100);

          const instructionsY = paymentSectionY + 70;
          doc.text("Payment Instructions:", margin, instructionsY);
          doc.text("1. Scan the QR code with any UPI app (PhonePe, GPay, Paytm, etc.)", margin, instructionsY + 15);
          doc.text("2. Verify the amount and merchant name", margin, instructionsY + 30);
          doc.text("3. Complete the payment", margin, instructionsY + 45);
          doc.text(`4. UPI ID: ${UPI_CONFIG.upiId}`, margin, instructionsY + 60);
          doc.setTextColor(0);

          // Generate filename and save (ONLY PDF DOWNLOAD)
          const customerName = customer?.name?.replace(/[^a-zA-Z0-9]/g, '_') || "Customer";
          const fileName = `Invoice_${customerName}_${startDate}_to_${endDate}.pdf`;
          doc.save(fileName);

          // Show simple success message
          setSuccessMessage("PDF downloaded successfully!");
          setTimeout(() => setSuccessMessage(""), 3000);
        };

        // Execute PDF generation
        generatePDF().catch((error) => {
          // console.error("Error in PDF generation:", error);
          setError("PDF generation failed. Please try again.");
        });
      })
      .catch((error) => {
        // console.error("Error loading dependencies:", error);
        setError("PDF generation failed. Please try again.");
      });
  };

  if (loading) {
    return (
      <div className="h-full bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-gray-600 mt-4">Loading customer data...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="h-full bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 text-lg">Customer not found</p>
          <button
            onClick={() => navigate("/admin/customers")}
            className="mt-4 text-blue-500 hover:text-blue-600"
          >
            Back to Customers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-100 p-3 sm:p-6 flex flex-col overflow-hidden">
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

      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 flex-shrink-0">
        <button
          onClick={() => navigate("/admin/customers")}
          className="p-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors duration-150 shadow-sm"
        >
          <ArrowLeftIcon className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
        <h1 className="text-lg sm:text-2xl font-bold text-black">Customer Invoice</h1>
      </div>

      {/* Customer Info Card with Overpaid Amount Field */}
      <div className="bg-white shadow-sm rounded-xl mb-4 sm:mb-6 flex-shrink-0">
        {/* Mobile Compact Header */}
        <div className="block lg:hidden p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-black truncate">{customer?.name}</h2>
              <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                <span>ID: {customer.customerId || customer.displayId || String(customer?.id || "").padStart(4, "0")}</span>
                <span>•</span>
                <span>{customer?.phone}</span>
                {totalUnpaidAmount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-red-600 font-medium">₹{totalUnpaidAmount} unpaid</span>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={handleCustomInvoice}
              disabled={orders.length === 0}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ml-3"
            >
              <CalendarIcon className="h-3 w-3" />
              Invoice
            </button>
          </div>

          {/* Mobile Overpaid Amount Section */}
          <div className="border-t border-gray-200 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">Overpaid Amount (Note):</span>
              {!editingOverpaid ? (
                <div className="flex items-center gap-2">
                  {overpaidAmount ? (
                    <>
                      <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                        ₹{overpaidAmount}
                      </span>
                      <button
                        onClick={startEditingOverpaid}
                        className="p-1 text-gray-400 hover:text-blue-600"
                      >
                        <PencilIcon className="h-3 w-3" />
                      </button>
                      <button
                        onClick={removeOverpaidAmount}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={startEditingOverpaid}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <CurrencyRupeeIcon className="h-3 w-3" />
                      Add Amount
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">₹</span>
                    <input
                      type="text"
                      value={tempOverpaidAmount}
                      onChange={handleOverpaidAmountChange}
                      onKeyDown={handleOverpaidKeyDown}
                      placeholder="0.00"
                      className="w-20 pl-5 pr-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={saveOverpaidEdit}
                    className="p-1 text-green-600 hover:text-green-700"
                  >
                    ✓
                  </button>
                  <button
                    onClick={cancelOverpaidEdit}
                    className="p-1 text-red-600 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop/Tablet Expanded Header */}
        <div className="hidden lg:block p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="grid grid-cols-6 gap-8">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Customer ID</p>
                <p className="text-lg font-semibold text-black">
                  {customer.customerId || customer.displayId || String(customer?.id || "").padStart(4, "0")}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Customer Name</p>
                <p className="text-lg font-semibold text-black">{customer?.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Phone Number</p>
                <p className="text-lg font-semibold text-black">{customer?.phone}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total Orders</p>
                <p className="text-lg font-semibold text-black">{orders.length}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total Amount</p>
                <p className="text-lg font-semibold text-black">₹{totalAmount}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total Unpaid</p>
                <p className="text-lg font-semibold text-red-600">₹{totalUnpaidAmount}</p>
              </div>
            </div>

            <button
              onClick={handleCustomInvoice}
              disabled={orders.length === 0}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg shadow-md font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CalendarIcon className="h-5 w-5" />
              Custom Invoice
            </button>
          </div>

          {/* Desktop Overpaid Amount Section */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CurrencyRupeeIcon className="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Overpaid Amount (Tracking Note):</span>
              </div>

              {!editingOverpaid ? (
                <div className="flex items-center gap-3">
                  {overpaidAmount ? (
                    <>
                      <span className="text-lg font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-lg">
                        ₹{overpaidAmount}
                      </span>
                      <button
                        onClick={startEditingOverpaid}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                        title="Edit overpaid amount"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={removeOverpaidAmount}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                        title="Remove overpaid amount"
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={startEditingOverpaid}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors duration-200"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add Overpaid Amount
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                    <input
                      type="text"
                      value={tempOverpaidAmount}
                      onChange={handleOverpaidAmountChange}
                      onKeyDown={handleOverpaidKeyDown}
                      placeholder="0.00"
                      className="w-32 pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={saveOverpaidEdit}
                    className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors duration-200"
                    title="Save"
                  >
                    ✓
                  </button>
                  <button
                    onClick={cancelOverpaidEdit}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200"
                    title="Cancel"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 Track extra payments from customers. This is for reference only and won't affect calculations.
            </p>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-lg flex-1 flex flex-col overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 px-4 sm:px-6">
          <button
            onClick={() => setActiveTab("purchase")}
            className={`px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200 ${activeTab === "purchase"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
          >
            Purchase History
          </button>
          <button
            onClick={() => setActiveTab("invoice")}
            className={`px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200 ${activeTab === "invoice"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
          >
            Invoice History
          </button>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto">
          {currentData.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-gray-500 text-lg">
                  {activeTab === "purchase" ? "No orders found" : "No invoices found"}
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  {activeTab === "purchase"
                    ? "This customer hasn't made any purchases yet"
                    : "No invoices have been sent to this customer yet"}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile: Card Layout */}
              <div className="block sm:hidden p-4 space-y-3">
                {activeTab === "purchase"
                  ? paginatedData.map((order, index) => (
                    <div
                      key={order.id}
                      className={`rounded-lg p-4 border border-gray-200 ${order.isEdited ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50'
                        }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-black text-sm truncate">
                              {order.itemName}
                            </h3>
                            {order.isEdited && (
                              <span className="px-2 py-1 bg-yellow-200 text-yellow-800 text-xs rounded-full font-medium">
                                Edited
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            ID: {order.itemId} • {order.date}
                          </p>
                          <p className="text-xs text-gray-600">
                            Qty: {order.quantity} × ₹{order.unitPrice}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-black text-sm mb-2">₹{order.total}</p>
                          {canEditPurchase(order).canEdit && (
                            <button
                              onClick={() => openEditModal(order)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors duration-200"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                  : paginatedData.map((invoice, index) => (
                    <div
                      key={invoice.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-black text-sm">
                            {invoice.invoiceId}
                          </h3>
                          <p className="text-xs text-gray-600 mt-1">
                            {invoice.startDate} to {invoice.endDate}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(invoice.paymentStatus)}`}
                            >
                              {invoice.paymentStatus}
                            </span>
                            {invoice.paymentStatus !== "paid" && (
                              <span className="text-xs text-red-600">
                                ₹{invoice.remainingAmount} due
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-black text-sm mb-2">
                            ₹{invoice.totalAmount}
                          </p>
                          {invoice.paymentStatus !== "paid" && (
                            <button
                              onClick={() => openPaymentModal(invoice)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors duration-200 mb-1"
                            >
                              Add Payment
                            </button>
                          )}
                          {invoice.payments.length > 0 && (
                            <button
                              onClick={() => togglePaymentHistory(invoice.id)}
                              className="block w-full bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs transition-colors duration-200"
                            >
                              {showPaymentHistory[invoice.id] ? "Hide" : "Show"} Payments ({invoice.payments.length})
                            </button>
                          )}
                        </div>
                      </div>

                      {showPaymentHistory[invoice.id] && invoice.payments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <h4 className="text-xs font-medium text-gray-700 mb-2">Payment History:</h4>
                          {invoice.payments.map((payment, idx) => (
                            <div key={payment.id} className="flex justify-between items-center text-xs text-gray-600 mb-1">
                              <div>
                                <span className="font-medium">₹{payment.amount}</span>
                                <span className="ml-2 text-gray-500">via {payment.method}</span>
                              </div>
                              <span>{new Date(payment.date).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>

              {/* Desktop: Table Layout */}
              <div className="hidden sm:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="text-black font-medium">
                        {activeTab === "purchase" ? (
                          <>
                            <th className="text-center px-6 py-3 w-32">Item ID</th>
                            <th className="text-center px-6 py-3 w-64">Item Name</th>
                            <th className="text-center px-6 py-3 w-32">Date</th>
                            <th className="text-center px-6 py-3 w-24">Quantity</th>
                            <th className="text-center px-6 py-3 w-32">Unit Price</th>
                            <th className="text-center px-6 py-3 w-32">Total</th>
                            <th className="text-center px-6 py-3 w-32">Actions</th>
                          </>
                        ) : (
                          <>
                            <th className="text-center px-6 py-3 w-32">Invoice ID</th>
                            <th className="text-center px-6 py-3 w-24">Dates</th>
                            <th className="text-center px-6 py-3 w-24">Total</th>
                            <th className="text-center px-6 py-3 w-24">Paid</th>
                            <th className="text-center px-6 py-3 w-24">Remaining</th>
                            <th className="text-center px-6 py-3 w-24">Status</th>
                            <th className="text-center px-6 py-3 w-32">Actions</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {activeTab === "purchase"
                        ? paginatedData.map((order, index) => (
                          <tr
                            key={order.id}
                            className={`hover:bg-gray-50 transition-colors duration-150 ${index !== paginatedData.length - 1
                              ? "border-b border-gray-200"
                              : ""
                              } ${order.isEdited ? 'bg-yellow-50' : ''}`}
                          >
                            <td className="text-center px-6 py-4 text-black w-32">
                              {order.itemId}
                            </td>
                            <td className="text-center px-6 py-4 text-black w-64">
                              <div className="flex items-center justify-center gap-2">
                                <span className="truncate">{order.itemName}</span>
                                {order.isEdited && (
                                  <span className="px-2 py-1 bg-yellow-200 text-yellow-800 text-xs rounded-full font-medium whitespace-nowrap">
                                    Edited
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="text-center px-6 py-4 text-black w-32">
                              {order.date}
                            </td>
                            <td className="text-center px-6 py-4 text-black w-24">
                              {order.quantity}
                            </td>
                            <td className="text-center px-6 py-4 text-black w-32">
                              ₹{order.unitPrice}
                            </td>
                            <td className="text-center px-6 py-4 text-black w-32 font-medium">
                              ₹{order.total}
                            </td>
                            <td className="text-center px-6 py-4 w-32">
                              {canEditPurchase(order).canEdit ? (
                                <button
                                  onClick={() => openEditModal(order)}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors duration-200 flex items-center gap-1 mx-auto"
                                >
                                  <PencilIcon className="h-3 w-3" />
                                  Edit
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400">
                                  {canEditPurchase(order).reason?.includes('24 hours') ? '24h expired' : 'In invoice'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                        : paginatedData.flatMap((invoice, index) => {
                          const rows = [
                            <tr
                              key={invoice.id}
                              className={`hover:bg-gray-50 transition-colors duration-150 ${index !== paginatedData.length - 1
                                ? "border-b border-gray-200"
                                : ""
                                }`}
                            >
                              <td className="text-center px-6 py-4 text-black w-32">
                                {invoice.invoiceId}
                              </td>
                              <td className="text-center px-6 py-4 text-black w-24 text-xs">
                                {invoice.startDate}<br />to<br />{invoice.endDate}
                              </td>
                              <td className="text-center px-6 py-4 text-black w-24 font-medium">
                                ₹{invoice.totalAmount}
                              </td>
                              <td className="text-center px-6 py-4 text-black w-24 font-medium">
                                ₹{invoice.paidAmount}
                              </td>
                              <td className="text-center px-6 py-4 w-24">
                                <span className={invoice.remainingAmount > 0 ? "text-red-600 font-medium" : "text-black"}>
                                  ₹{invoice.remainingAmount}
                                </span>
                              </td>
                              <td className="text-center px-6 py-4 w-24">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(invoice.paymentStatus)}`}
                                >
                                  {invoice.paymentStatus}
                                </span>
                              </td>
                              <td className="text-center px-6 py-4 w-32">
                                <div className="flex flex-col gap-1">
                                  {invoice.paymentStatus !== "paid" && (
                                    <button
                                      onClick={() => openPaymentModal(invoice)}
                                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors duration-200"
                                    >
                                      Add Payment
                                    </button>
                                  )}
                                  {invoice.payments.length > 0 && (
                                    <button
                                      onClick={() => togglePaymentHistory(invoice.id)}
                                      className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs rounded-lg transition-colors duration-200"
                                    >
                                      {showPaymentHistory[invoice.id] ? "Hide" : "Show"} Payments
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ];

                          if (showPaymentHistory[invoice.id] && invoice.payments.length > 0) {
                            rows.push(
                              <tr key={`${invoice.id}-payments`} className="bg-blue-50">
                                <td colSpan="7" className="px-6 py-4">
                                  <div className="text-sm">
                                    <h4 className="font-medium text-gray-700 mb-2">Payment History:</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      {invoice.payments.map((payment, idx) => (
                                        <div key={payment.id} className="flex justify-between items-center bg-white rounded p-2 text-xs">
                                          <div>
                                            <span className="font-medium">₹{payment.amount}</span>
                                            <span className="ml-2 text-gray-500">via {payment.method}</span>
                                            {payment.notes && (
                                              <span className="block text-gray-400 italic">{payment.notes}</span>
                                            )}
                                          </div>
                                          <span className="text-gray-600">{new Date(payment.date).toLocaleDateString()}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return rows;
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>

              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="text-sm text-gray-600">
              Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, currentData.length)} of {currentData.length}
            </div>
          </div>
        )}
      </div>

      {/* Edit Purchase Modal */}
      {showEditModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-black">Edit Purchase</h3>
              <button
                onClick={closeEditModal}
                disabled={isUpdating}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 disabled:opacity-50"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-black mb-3">Purchase Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Item Name</p>
                    <p className="font-medium text-black">{selectedPurchase.itemName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Item ID</p>
                    <p className="font-medium text-black">{selectedPurchase.itemId}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Unit Price</p>
                    <p className="font-medium text-black">₹{selectedPurchase.unitPrice}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Purchase Date</p>
                    <p className="font-medium text-black">{selectedPurchase.date}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Quantity *
                  </label>
                  <input
                    type="text"
                    placeholder="1"
                    value={editQuantity}
                    onChange={handleQuantityChange}
                    disabled={isUpdating}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current quantity: {selectedPurchase.quantity}
                  </p>
                </div>

                {editQuantity && parseInt(editQuantity) > 0 && (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>New Total:</strong> ₹{selectedPurchase.unitPrice * parseInt(editQuantity)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-gray-200 gap-3">
              <button
                onClick={deletePurchase}
                disabled={isUpdating}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
              >
                <TrashIcon className="h-4 w-4" />
                Delete
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={closeEditModal}
                  disabled={isUpdating}
                  className="px-4 py-2 text-black bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors duration-150 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={updatePurchase}
                  disabled={!editQuantity || parseInt(editQuantity) <= 0 || isUpdating}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                >
                  {isUpdating ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <PencilIcon className="h-4 w-4" />
                      Update Purchase
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-black">Add Payment</h3>
              <button
                onClick={closePaymentModal}
                disabled={addingPayment}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 disabled:opacity-50"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-black mb-3">Invoice Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Invoice ID</p>
                    <p className="font-medium text-black">{selectedInvoice.invoiceId}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total Amount</p>
                    <p className="font-medium text-black">₹{selectedInvoice.totalAmount}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Paid Amount</p>
                    <p className="font-medium text-green-600">₹{selectedInvoice.paidAmount}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Remaining Amount</p>
                    <p className="font-medium text-red-600">₹{selectedInvoice.remainingAmount}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Payment Amount *
                  </label>
                  <input
                    type="text"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={handlePaymentAmountChange}
                    disabled={addingPayment}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum: ₹{selectedInvoice.remainingAmount}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Payment Method *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    disabled={addingPayment}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    placeholder="Add any notes about this payment..."
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    disabled={addingPayment}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end px-4 sm:px-6 py-4 border-t border-gray-200 gap-3">
              <button
                onClick={closePaymentModal}
                disabled={addingPayment}
                className="px-4 py-2 text-black bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors duration-150 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={addPayment}
                disabled={!paymentAmount || addingPayment}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
              >
                {addingPayment ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Adding Payment...
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-4 w-4" />
                    Add Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Invoice Modal */}
      {/* Custom Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-black">
                Generate Custom Invoice
              </h3>
              <button
                onClick={closeModal}
                disabled={sendingInvoice}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 disabled:opacity-50"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={sendingInvoice}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={sendingInvoice}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {startDate && endDate && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h4 className="font-medium text-black mb-3">Invoice Summary</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Date Range</p>
                      <p className="font-medium text-black">
                        {startDate} to {endDate}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Orders</p>
                      <p className="font-medium text-black">{selectedOrders.length}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Amount</p>
                      <p className="font-medium text-black">₹{selectedTotalAmount}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedOrders.length === 0 && startDate && endDate && (
                <div className="text-center py-8 text-gray-500">
                  No orders found in the selected date range.
                </div>
              )}
            </div>

            {/* Updated buttons section */}
            <div className="px-4 sm:px-6 py-4 border-t border-gray-200">
              {/* Export PDF Button */}
              <div className="flex justify-center mb-4">
                <button
                  onClick={exportToPDF}
                  disabled={selectedOrders.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <DocumentDownloadIcon className="h-4 w-4" />
                  Export to PDF Only
                </button>
              </div>

              {/* WhatsApp Sending Options */}
              <div className="space-y-3">
                <div className="text-center">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">📱 WhatsApp Invoice Options</h4>
                </div>

                {/* Manual WhatsApp Button */}
                <button
                  onClick={sendInvoiceManually}
                  disabled={selectedOrders.length === 0 || sendingInvoice}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingInvoice ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                      </svg>
                      📱 Send Manually (Open WhatsApp)
                    </>
                  )}
                </button>

                {/* Automatic WhatsApp Button */}
                <button
                  onClick={sendInvoice}
                  disabled={selectedOrders.length === 0 || sendingInvoice}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingInvoice ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                      🚀 Send Automatically (Auto WhatsApp)
                    </>
                  )}
                </button>

                {/* Help text */}
                <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span>📱</span>
                    <span><strong>Manual:</strong> Opens WhatsApp with message + downloads PDF (you attach PDF manually)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>🚀</span>
                    <span><strong>Automatic:</strong> Sends via server (when Twilio is configured)</span>
                  </div>
                </div>
              </div>

              {/* Cancel Button */}
              <div className="flex justify-center mt-4">
                <button
                  onClick={closeModal}
                  disabled={sendingInvoice}
                  className="px-6 py-2 text-black bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors duration-150 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}