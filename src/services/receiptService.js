// services/receiptService.js
import { whatsappService } from './whatsappService';
import printerService from './printerService';

export const receiptService = {
  async sendAndPrintReceipt(purchaseDetails, options = {}) {
    const {
      sendWhatsApp = true,
      printReceipt = true,
      autoConnectPrinter = true,
    } = options;

    const results = {
      whatsapp: { success: false },
      print: { success: false },
      errors: []
    };

    // 1. Send WhatsApp
    if (sendWhatsApp) {
      try {
        results.whatsapp = whatsappService.sendPurchaseReceipt(
          purchaseDetails.customer.phone,
          purchaseDetails
        );
      } catch (error) {
        results.errors.push('WhatsApp: ' + error.message);
      }
    }

    // 2. Print Receipt
    if (printReceipt) {
      try {
        if (!printerService.isConnected() && autoConnectPrinter) {
          const connectResult = await printerService.connect();
          if (!connectResult.success) {
            results.print = {
              success: false,
              message: 'Printer not connected',
              needsConnection: true
            };
            results.errors.push('Print: Printer not connected');
            return results;
          }
        }

        results.print = await printerService.printPurchaseReceipt(purchaseDetails);
        
        if (!results.print.success) {
          results.errors.push('Print: ' + results.print.message);
        }
      } catch (error) {
        results.print = {
          success: false,
          message: error.message
        };
        results.errors.push('Print: ' + error.message);
      }
    }

    return results;
  },

  checkPrinterStatus() {
    return {
      isConnected: printerService.isConnected(),
      deviceName: printerService.device?.name || null
    };
  },

  async connectPrinter() {
    return await printerService.connect();
  },

  async testPrint() {
    return await printerService.testPrint();
  }
};

export default receiptService;