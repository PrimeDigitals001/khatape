// services/whatsappService.js

// WhatsApp Service for sending purchase receipts and invoices
export const whatsappService = {
  // Send purchase receipt via WhatsApp
  sendPurchaseReceipt: (customerPhone, purchaseDetails) => {
    try {
      // Format the phone number
      const formattedPhone = formatPhoneNumber(customerPhone);

      // Create WhatsApp message content
      const message = createPurchaseMessage(purchaseDetails);

      // Create WhatsApp URL
      const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

      // Open WhatsApp in new tab
      window.open(whatsappUrl, '_blank');

      return {
        success: true,
        message: 'WhatsApp opened successfully',
        phone: formattedPhone,
        type: 'purchase'
      };
    } catch (error) {
      console.error('Error sending WhatsApp purchase receipt:', error);
      return {
        success: false,
        message: 'Failed to send WhatsApp message',
        error: error.message,
        type: 'purchase'
      };
    }
  },

  // Send invoice receipt via WhatsApp
  sendInvoiceReceipt: (customerPhone, invoiceDetails) => {
    try {
      // Format the phone number
      const formattedPhone = formatPhoneNumber(customerPhone);

      // Create WhatsApp message content
      const message = createInvoiceMessage(invoiceDetails);

      // Create WhatsApp URL
      const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

      // Open WhatsApp in new tab
      window.open(whatsappUrl, '_blank');

      return {
        success: true,
        message: 'WhatsApp opened successfully',
        phone: formattedPhone,
        type: 'invoice'
      };
    } catch (error) {
      console.error('Error sending WhatsApp invoice:', error);
      return {
        success: false,
        message: 'Failed to send WhatsApp message',
        error: error.message,
        type: 'invoice'
      };
    }
  },

  // ✅ NEW: Send payment confirmation via WhatsApp
  sendPaymentConfirmation: (customerPhone, paymentDetails) => {
    try {
      // Format the phone number
      const formattedPhone = formatPhoneNumber(customerPhone);

      // Create WhatsApp message content based on payment status
      const message = createPaymentConfirmationMessage(paymentDetails);

      // Create WhatsApp URL
      const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

      // Open WhatsApp in new tab
      window.open(whatsappUrl, '_blank');

      return {
        success: true,
        message: 'WhatsApp opened successfully',
        phone: formattedPhone,
        type: 'payment_confirmation'
      };
    } catch (error) {
      console.error('Error sending WhatsApp payment confirmation:', error);
      return {
        success: false,
        message: 'Failed to send WhatsApp message',
        error: error.message,
        type: 'payment_confirmation'
      };
    }
  },

  // Send custom message via WhatsApp
  sendCustomMessage: (customerPhone, message) => {
    try {
      // Format the phone number
      const formattedPhone = formatPhoneNumber(customerPhone);

      // Create WhatsApp URL
      const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

      // Open WhatsApp in new tab
      window.open(whatsappUrl, '_blank');

      return {
        success: true,
        message: 'WhatsApp opened successfully',
        phone: formattedPhone,
        type: 'custom'
      };
    } catch (error) {
      console.error('Error sending custom WhatsApp message:', error);
      return {
        success: false,
        message: 'Failed to send WhatsApp message',
        error: error.message,
        type: 'custom'
      };
    }
  },

  // Validate phone number
  validatePhoneNumber: (phone) => {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      return {
        isValid: true,
        formattedPhone: formattedPhone,
        message: 'Phone number is valid'
      };
    } catch (error) {
      return {
        isValid: false,
        formattedPhone: null,
        message: error.message
      };
    }
  }
};

// Helper function to format phone number
function formatPhoneNumber(customerPhone) {
  if (!customerPhone) {
    throw new Error('Phone number is required');
  }

  // Remove all spaces and special characters except +
  let formattedPhone = customerPhone.replace(/[^\d+]/g, '');

  // If phone doesn't start with +91, add it
  if (!formattedPhone.startsWith('+91')) {
    if (formattedPhone.startsWith('91') && formattedPhone.length === 12) {
      formattedPhone = '+' + formattedPhone;
    } else if (formattedPhone.startsWith('0')) {
      formattedPhone = '+91' + formattedPhone.substring(1);
    } else if (formattedPhone.length === 10) {
      formattedPhone = '+91' + formattedPhone;
    } else {
      formattedPhone = '+91' + formattedPhone;
    }
  }

  // Validate final phone number format
  if (!formattedPhone.match(/^\+91\d{10}$/)) {
    throw new Error('Invalid phone number format');
  }

  return formattedPhone;
}

// Helper function to create purchase message
function createPurchaseMessage(purchaseDetails) {
  try {
    const { customer, items, total, timestamp, transactionId } = purchaseDetails;

    if (!customer || !items || !total) {
      throw new Error('Missing required purchase details');
    }

    const message = `🛒 *PURCHASE RECEIPT*

👤 *Customer:* ${customer.name}
📱 *Phone:* ${customer.phone}
🆔 *Transaction ID:* ${transactionId || 'N/A'}
📅 *Date:* ${new Date(timestamp).toLocaleDateString('en-IN')}
🕐 *Time:* ${new Date(timestamp).toLocaleTimeString('en-IN')}

📦 *ITEMS PURCHASED:*
${items.map(item => {
      // Calculate total if not present (handle both cases)
      const itemTotal = item.total || (item.price * item.quantity) || (item.unitPrice * item.quantity) || 0;
      const unitPrice = item.unitPrice || item.price || 0;

      return `• ${item.name || item.itemName} x${item.quantity} @ ₹${unitPrice} = ₹${itemTotal.toFixed(2)}`;
    }).join('\n')}

💰 *TOTAL AMOUNT: ₹${total.toFixed(2)}*

Thank you for your purchase!`;

    return message;
  } catch (error) {
    console.error('Error creating purchase message:', error);
    throw new Error('Failed to create purchase message');
  }
}

// Helper function to create invoice message
function createInvoiceMessage(invoiceDetails) {
  try {
    const {
      customer,
      invoiceId,
      startDate,
      endDate,
      orders,
      totalAmount,
      paidAmount = 0,
      remainingAmount,
      paymentStatus = 'unpaid',
      storeName = "Chamunda-Dairy"
    } = invoiceDetails;

    if (!customer || !orders || !totalAmount) {
      throw new Error('Missing required invoice details');
    }

    // Calculate remaining amount if not provided
    const remaining = remainingAmount !== undefined ? remainingAmount : (totalAmount - paidAmount);

    const message = `🧾 *INVOICE FROM ${storeName.toUpperCase()}*

👤 *Customer:* ${customer.name}
📱 *Phone:* ${customer.phone}
🆔 *Invoice ID:* ${invoiceId}
📅 *Period:* ${startDate} to ${endDate}
📦 *Total Orders:* ${orders.length}

💰 *TOTAL AMOUNT:* ₹${totalAmount.toFixed(2)}
✅ *PAID AMOUNT:* ₹${paidAmount.toFixed(2)}
⏳ *REMAINING:* ₹${remaining.toFixed(2)}
📊 *STATUS:* ${paymentStatus.toUpperCase()}

📄 *Invoice PDF is being attached above*
💳 *UPI Payment available via QR code in PDF*

Please make payment as per agreed terms.

Thank you for your business!
*${storeName} Team*`;

    return message;
  } catch (error) {
    console.error('Error creating invoice message:', error);
    throw new Error('Failed to create invoice message');
  }
}

// ✅ NEW: Helper function to create payment confirmation message
function createPaymentConfirmationMessage(paymentDetails) {
  try {
    const {
      customer,
      invoiceId,
      paymentAmount,
      totalAmount,
      paidAmount,
      remainingAmount,
      paymentMethod,
      paymentStatus,
      storeName = "Chamunda-Dairy"
    } = paymentDetails;

    if (!customer || !paymentAmount) {
      throw new Error('Missing required payment details');
    }

    // Format payment method for display
    const formattedPaymentMethod = paymentMethod
      ? paymentMethod.replace('_', ' ').toUpperCase()
      : 'CASH';

    // Get current date and time
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });

    if (paymentStatus === "paid") {
      // ✅ FULL PAYMENT - Bill Cleared Message
      const message = `✅ *PAYMENT CONFIRMATION*

🎉 *Congratulations! Your bill is FULLY CLEARED!*

━━━━━━━━━━━━━━━━━━━━
👤 *Customer:* ${customer.name}
🧾 *Invoice ID:* ${invoiceId}
📅 *Date:* ${dateStr}
🕐 *Time:* ${timeStr}
━━━━━━━━━━━━━━━━━━━━

💰 *Payment Received:* ₹${paymentAmount.toFixed(2)}
💳 *Payment Method:* ${formattedPaymentMethod}

━━━━━━━━━━━━━━━━━━━━
📊 *FINAL BILL SUMMARY:*
━━━━━━━━━━━━━━━━━━━━
• Total Bill Amount: ₹${totalAmount.toFixed(2)}
• Total Paid: ₹${paidAmount.toFixed(2)}
• *Balance Due: ₹0.00* ✅

🌟 *STATUS: FULLY PAID* 🌟

Thank you for clearing your dues!
We appreciate your prompt payment.

*${storeName} Team* 🙏`;

      return message;
    } else {
      // ⏳ PARTIAL PAYMENT Message
      const message = `✅ *PAYMENT RECEIVED*

━━━━━━━━━━━━━━━━━━━━
👤 *Customer:* ${customer.name}
🧾 *Invoice ID:* ${invoiceId}
📅 *Date:* ${dateStr}
🕐 *Time:* ${timeStr}
━━━━━━━━━━━━━━━━━━━━

💰 *Payment Received:* ₹${paymentAmount.toFixed(2)}
💳 *Payment Method:* ${formattedPaymentMethod}

━━━━━━━━━━━━━━━━━━━━
📊 *UPDATED BALANCE:*
━━━━━━━━━━━━━━━━━━━━
• Total Bill Amount: ₹${totalAmount.toFixed(2)}
• Total Paid: ₹${paidAmount.toFixed(2)}
• *Remaining Due: ₹${remainingAmount.toFixed(2)}* ⏳

📌 *STATUS: PARTIALLY PAID*

Please clear the remaining balance of *₹${remainingAmount.toFixed(2)}* at your earliest convenience.

Thank you for your payment!

*${storeName} Team* 🙏`;

      return message;
    }
  } catch (error) {
    console.error('Error creating payment confirmation message:', error);
    throw new Error('Failed to create payment confirmation message');
  }
}

// Helper function to create payment reminder message
function createPaymentReminderMessage(invoiceDetails) {
  try {
    const {
      customer,
      invoiceId,
      remainingAmount,
      dueDate,
      storeName = "Chamunda-Dairy"
    } = invoiceDetails;

    const message = `⏰ *PAYMENT REMINDER*

👤 *Customer:* ${customer.name}
🧾 *Invoice ID:* ${invoiceId}
💰 *Amount Due:* ₹${remainingAmount.toFixed(2)}
📅 *Due Date:* ${dueDate}

Please complete your payment at your earliest convenience.

Thank you for your cooperation!

*${storeName} Team*`;

    return message;
  } catch (error) {
    console.error('Error creating payment reminder message:', error);
    throw new Error('Failed to create payment reminder message');
  }
}

// Export additional helper functions for external use
export const whatsappHelpers = {
  formatPhoneNumber,
  createPurchaseMessage,
  createInvoiceMessage,
  createPaymentConfirmationMessage,
  createPaymentReminderMessage
};

// Export default
export default whatsappService;