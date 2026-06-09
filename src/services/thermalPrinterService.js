// services/thermalPrinterService.js
// ✅ ULTRA-SIMPLE - No stretching, basic text only

class ThermalPrinterService {
  constructor() {
    this.device = null;
    this.characteristic = null;
    this.isConnected = false;
    
    // MINIMAL ESC/POS Commands
    this.INIT = '\x1B\x40';           // Initialize
    this.FEED = '\x0A';                // Line feed
    this.CUT = '\x1D\x56\x00';        // Cut paper
    
    // ONLY BASIC FORMATTING
    this.ALIGN_LEFT = '\x1B\x61\x00';
    this.ALIGN_CENTER = '\x1B\x61\x01';
    this.BOLD_ON = '\x1B\x45\x01';
    this.BOLD_OFF = '\x1B\x45\x00';
    
    // NO FANCY FONTS - Use default only
    this.NORMAL = '\x1B\x21\x00';
    
    // 58mm = 32 characters per line (standard)
    this.WIDTH = 32;
  }

  /**
   * Simple line separator
   */
  line(char = '-') {
    return char.repeat(this.WIDTH) + '\n';
  }

  /**
   * Pad text left and right
   */
  pad(left, right) {
    const space = this.WIDTH - left.length - right.length;
    return left + ' '.repeat(Math.max(space, 1)) + right + '\n';
  }

  /**
   * Center text
   */
  center(text) {
    const space = Math.floor((this.WIDTH - text.length) / 2);
    return ' '.repeat(Math.max(space, 0)) + text + '\n';
  }

  /**
   * Truncate text if too long
   */
  cut(text, max) {
    return text.length > max ? text.substring(0, max - 2) + '..' : text;
  }

  async connectBluetooth() {
    try {
      if (!navigator.bluetooth) {
        throw new Error('Bluetooth not supported. Use Chrome/Edge browser.');
      }

      console.log('🔍 Looking for printer...');

      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          '0000fff0-0000-1000-8000-00805f9b34fb',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        ]
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        console.log('⚠️ Printer disconnected');
        this.isConnected = false;
        this.characteristic = null;
      });

      const server = await this.device.gatt.connect();
      const services = await server.getPrimaryServices();
      
      let connected = false;
      
      for (const service of services) {
        try {
          const chars = await service.getCharacteristics();
          
          for (const char of chars) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              this.characteristic = char;
              connected = true;
              break;
            }
          }
          if (connected) break;
        } catch (e) {
          continue;
        }
      }

      if (!connected) {
        throw new Error('Printer not found. Turn on printer and retry.');
      }

      this.isConnected = true;
      console.log('✅ Connected:', this.device.name);

      return {
        success: true,
        message: `Connected to ${this.device.name}`,
        deviceName: this.device.name
      };
    } catch (error) {
      console.error('❌ Error:', error);
      this.isConnected = false;
      
      if (error.name === 'NotFoundError') {
        return { success: false, message: 'No device selected', cancelled: true };
      }
      
      return { success: false, message: error.message || 'Failed to connect' };
    }
  }

  async disconnect() {
    try {
      if (this.device && this.device.gatt.connected) {
        await this.device.gatt.disconnect();
      }
      
      this.device = null;
      this.characteristic = null;
      this.isConnected = false;

      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async printPurchaseReceipt(purchaseDetails) {
    try {
      if (!this.isConnected) {
        throw new Error('Printer not connected');
      }

      const receipt = this.formatReceipt(purchaseDetails);
      await this.send(receipt);

      console.log('✅ Printed!');
      return { success: true, message: 'Printed successfully' };
    } catch (error) {
      console.error('❌ Print error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 🔧 SUPER COMPACT FORMAT - Plain text only
   */
  formatReceipt(details) {
    const { customer, items, total, timestamp } = details;
    
    let r = '';
    
    // Init
    r += this.INIT;
    r += this.NORMAL;
    
    // Header (centered, bold)
    r += this.ALIGN_CENTER;
    r += this.BOLD_ON;
    r += this.center('Chamunda Dairy');
    r += this.BOLD_OFF;
    r += this.center('Purchase Receipt');
    
    // Date (small)
    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    });
    r += this.center(dateStr);
    r += '\n';
    
    // Back to left align
    r += this.ALIGN_LEFT;
    r += this.line('=');
    
    // Customer (compact)
    r += this.BOLD_ON;
    const name = this.cut(customer.name, this.WIDTH);
    r += name + '\n';
    r += this.BOLD_OFF;
    
    const phone = String(customer.phone).substring(0, 10);
    const id = String(customer.customerId || customer.id).substring(0, 10);
    r += `Ph:${phone} ID:${id}\n`;
    
    r += this.line('=');
    
    // Items
    r += this.BOLD_ON;
    r += 'ITEMS\n';
    r += this.BOLD_OFF;
    r += this.line('-');
    
    items.forEach(item => {
      const total = item.total || (item.price * item.quantity) || (item.unitPrice * item.quantity) || 0;
      const price = item.unitPrice || item.price || 0;
      const name = item.name || item.itemName || 'Item';
      
      // Item name (truncated)
      const itemName = this.cut(name, this.WIDTH);
      r += itemName + '\n';
      
      // Qty x Price = Total
      const qty = `${item.quantity}x`;
      const priceStr = `Rs${price.toFixed(2)}`;
      const totalStr = `Rs${total.toFixed(2)}`;
      
      r += this.pad(` ${qty} ${priceStr}`, totalStr);
    });
    
    r += this.line('-');
    
    // Total (right aligned)
    r += this.BOLD_ON;
    const totalLine = `TOTAL: Rs.${total.toFixed(2)}`;
    const totalSpaces = this.WIDTH - totalLine.length;
    r += ' '.repeat(Math.max(totalSpaces, 0)) + totalLine + '\n';
    r += this.BOLD_OFF;
    
    r += this.line('=');
    
    // Footer (centered)
    r += this.ALIGN_CENTER;
    r += this.center('Thank you!');
    r += this.center('Visit again!');
    
    // Feed and cut
    r += '\n\n\n';
    r += this.CUT;
    
    return r;
  }

  /**
   * Send to printer
   */
  async send(data) {
    if (!this.characteristic) {
      throw new Error('Not connected');
    }

    try {
      // Convert to bytes
      const bytes = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) {
        bytes[i] = data.charCodeAt(i) & 0xFF;
      }
      
      // Small chunks for mobile Bluetooth
      const chunkSize = 20;
      
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
        
        if (this.characteristic.properties.writeWithoutResponse) {
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.characteristic.writeValue(chunk);
        }
        
        // Wait between chunks
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      console.log('✅ Sent');
    } catch (error) {
      console.error('❌ Send error:', error);
      throw error;
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      deviceName: this.device?.name || null
    };
  }

  async testPrint() {
    const test = {
      customer: {
        name: 'Rajesh Kumar',
        phone: '9876543210',
        customerId: 'C001'
      },
      items: [
        { name: 'Milk 500ml', quantity: 2, unitPrice: 25, total: 50 },
        { name: 'Curd 200g', quantity: 1, unitPrice: 30, total: 30 }
      ],
      total: 80,
      timestamp: new Date()
    };

    return this.printPurchaseReceipt(test);
  }
}

const thermalPrinterService = new ThermalPrinterService();
export default thermalPrinterService;