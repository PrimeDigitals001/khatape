// services/printerService.js

class ThermalPrinterService {
  constructor() {
    this.device = null;
    this.characteristic = null;
    this.encoder = new TextEncoder();
  }

  // ESC/POS Commands
  ESC = '\x1B';
  GS = '\x1D';

  commands = {
    INIT: '\x1B\x40',
    ALIGN_LEFT: '\x1B\x61\x00',
    ALIGN_CENTER: '\x1B\x61\x01',
    ALIGN_RIGHT: '\x1B\x61\x02',
    BOLD_ON: '\x1B\x45\x01',
    BOLD_OFF: '\x1B\x45\x00',
    FONT_NORMAL: '\x1B\x21\x00',
    FONT_MEDIUM: '\x1B\x21\x10',
    FONT_LARGE: '\x1B\x21\x30',
    LINE_FEED: '\x0A',
    CUT_PAPER: '\x1D\x56\x00',
  };

  async connect() {
    try {
      console.log('Requesting Bluetooth Device...');

      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'SZB' },
          { namePrefix: 'Veer' },
        ],
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        ]
      });

      const server = await this.device.gatt.connect();

      let service;
      try {
        service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      } catch (e) {
        service = await server.getPrimaryService('49535343-fe7d-4ae5-8fa9-9fafd205e455');
      }

      try {
        this.characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      } catch (e) {
        this.characteristic = await service.getCharacteristic('49535343-8841-43f4-a8d4-ecbe34729bb3');
      }

      console.log('Printer connected!');

      return {
        success: true,
        message: 'Printer connected successfully',
        deviceName: this.device.name
      };
    } catch (error) {
      console.error('Connection error:', error);
      return {
        success: false,
        message: 'Failed to connect to printer',
        error: error.message
      };
    }
  }

  async disconnect() {
    try {
      if (this.device && this.device.gatt.connected) {
        await this.device.gatt.disconnect();
        this.device = null;
        this.characteristic = null;
        return { success: true };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  isConnected() {
    return this.device && this.device.gatt.connected;
  }

  async sendData(data) {
    if (!this.isConnected()) {
      throw new Error('Printer not connected');
    }

    const encoded = typeof data === 'string'
      ? this.encoder.encode(data)
      : data;

    const chunkSize = 20;
    for (let i = 0; i < encoded.length; i += chunkSize) {
      const chunk = encoded.slice(i, i + chunkSize);
      await this.characteristic.writeValue(chunk);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  async printPurchaseReceipt(purchaseDetails) {
    try {
      if (!this.isConnected()) {
        throw new Error('Printer not connected');
      }

      const receipt = this.formatPurchaseReceipt(purchaseDetails);
      await this.sendData(receipt);

      return {
        success: true,
        message: 'Receipt printed successfully'
      };
    } catch (error) {
      console.error('Print error:', error);
      return {
        success: false,
        message: 'Failed to print receipt',
        error: error.message
      };
    }
  }

  formatPurchaseReceipt(purchaseDetails) {
    const { customer, items, total, timestamp, transactionId, storeName = 'Chamunda-Dairy' } = purchaseDetails;

    let receipt = '';

    receipt += this.commands.INIT;
    receipt += this.commands.ALIGN_CENTER;
    receipt += this.commands.FONT_LARGE;
    receipt += this.commands.BOLD_ON;
    receipt += storeName.toUpperCase();
    receipt += this.commands.LINE_FEED;
    receipt += this.commands.BOLD_OFF;
    receipt += this.commands.FONT_NORMAL;
    receipt += this.commands.LINE_FEED;

    receipt += this.commands.ALIGN_CENTER;
    receipt += 'PURCHASE RECEIPT';
    receipt += this.commands.LINE_FEED;
    receipt += this.printLine('-', 32);
    receipt += this.commands.LINE_FEED;

    receipt += this.commands.ALIGN_LEFT;
    receipt += `Customer: ${customer.name}`;
    receipt += this.commands.LINE_FEED;
    receipt += `Phone: ${customer.phone}`;
    receipt += this.commands.LINE_FEED;
    receipt += `ID: ${customer.customerId || customer.id}`;
    receipt += this.commands.LINE_FEED;
    receipt += `Transaction: ${transactionId || 'N/A'}`;
    receipt += this.commands.LINE_FEED;

    const date = new Date(timestamp);
    receipt += `Date: ${date.toLocaleDateString('en-IN')}`;
    receipt += this.commands.LINE_FEED;
    receipt += `Time: ${date.toLocaleTimeString('en-IN')}`;
    receipt += this.commands.LINE_FEED;
    receipt += this.printLine('-', 32);
    receipt += this.commands.LINE_FEED;

    receipt += this.commands.BOLD_ON;
    receipt += 'ITEMS:';
    receipt += this.commands.BOLD_OFF;
    receipt += this.commands.LINE_FEED;
    receipt += this.printLine('-', 32);
    receipt += this.commands.LINE_FEED;

    items.forEach(item => {
      const itemTotal = item.total || (item.price * item.quantity) || (item.unitPrice * item.quantity) || 0;
      const unitPrice = item.unitPrice || item.price || 0;
      const itemName = item.name || item.itemName;

      receipt += itemName;
      if (item.isCustom) {
        receipt += ' (Manual)';
      }
      receipt += this.commands.LINE_FEED;

      const qtyLine = `  ${item.quantity} x Rs.${unitPrice.toFixed(2)}`;
      const priceStr = `Rs.${itemTotal.toFixed(2)}`;
      receipt += this.formatLine(qtyLine, priceStr, 32);
      receipt += this.commands.LINE_FEED;
    });

    receipt += this.printLine('-', 32);
    receipt += this.commands.LINE_FEED;

    receipt += this.commands.FONT_MEDIUM;
    receipt += this.commands.BOLD_ON;
    receipt += this.formatLine('TOTAL:', `Rs.${total.toFixed(2)}`, 32);
    receipt += this.commands.BOLD_OFF;
    receipt += this.commands.FONT_NORMAL;
    receipt += this.commands.LINE_FEED;
    receipt += this.printLine('=', 32);
    receipt += this.commands.LINE_FEED;

    receipt += this.commands.ALIGN_CENTER;
    receipt += this.commands.LINE_FEED;
    receipt += 'Thank you for your purchase!';
    receipt += this.commands.LINE_FEED;
    receipt += this.commands.LINE_FEED;
    receipt += this.commands.LINE_FEED;

    receipt += this.commands.CUT_PAPER;

    return receipt;
  }

  printLine(char, length) {
    return char.repeat(length);
  }

  formatLine(left, right, width) {
    const spacing = width - left.length - right.length;
    if (spacing < 1) {
      return left + ' ' + right;
    }
    return left + ' '.repeat(spacing) + right;
  }

  async testPrint() {
    try {
      if (!this.isConnected()) {
        throw new Error('Printer not connected');
      }

      let testReceipt = '';
      testReceipt += this.commands.INIT;
      testReceipt += this.commands.ALIGN_CENTER;
      testReceipt += this.commands.FONT_LARGE;
      testReceipt += 'TEST PRINT';
      testReceipt += this.commands.LINE_FEED;
      testReceipt += this.commands.FONT_NORMAL;
      testReceipt += this.printLine('-', 32);
      testReceipt += this.commands.LINE_FEED;
      testReceipt += 'Printer is working!';
      testReceipt += this.commands.LINE_FEED;
      testReceipt += this.commands.LINE_FEED;
      testReceipt += this.commands.LINE_FEED;
      testReceipt += this.commands.CUT_PAPER;

      await this.sendData(testReceipt);

      return {
        success: true,
        message: 'Test print completed'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const printerService = new ThermalPrinterService();
export default printerService;