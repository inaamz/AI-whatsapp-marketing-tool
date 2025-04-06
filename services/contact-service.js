const XLSX = require('xlsx');
const Store = require('electron-store');

class ContactService {
  constructor() {
    this.store = new Store({ name: 'contacts' });
    this.contacts = this.loadContacts();
  }

  // Load contacts from storage
  loadContacts() {
    return this.store.get('contacts', []);
  }

  // Save contacts to storage
  saveContacts() {
    this.store.set('contacts', this.contacts);
    return this.contacts.length;
  }

  // Get all contacts
  getAllContacts() {
    return this.contacts;
  }

  // Get contacts by status
  getContactsByStatus(status) {
    return this.contacts.filter(contact => contact.status === status);
  }

  // Get pending contacts
  getPendingContacts() {
    return this.contacts.filter(contact => 
      !contact.status || contact.status === 'Pending' || contact.status === 'Failed');
  }

  // Add contacts
  addContacts(newContacts) {
    // Keep track of existing phone numbers to avoid duplicates
    const existingPhones = new Set(this.contacts.map(c => this.normalizePhone(c.phone)));
    
    const uniqueContacts = newContacts.filter(contact => {
      const normalizedPhone = this.normalizePhone(contact.phone);
      if (!normalizedPhone) return false;
      
      if (existingPhones.has(normalizedPhone)) {
        return false; // Skip duplicates
      }
      
      existingPhones.add(normalizedPhone);
      return true;
    });
    
    this.contacts = [...this.contacts, ...uniqueContacts];
    this.saveContacts();
    return uniqueContacts.length;
  }

  // Remove contact by index
  removeContact(index) {
    if (index >= 0 && index < this.contacts.length) {
      this.contacts.splice(index, 1);
      this.saveContacts();
      return true;
    }
    return false;
  }

  // Clear all contacts
  clearContacts() {
    const count = this.contacts.length;
    this.contacts = [];
    this.saveContacts();
    return count;
  }

  // Update contact status
  updateContactStatus(phone, status) {
    const normalizedPhone = this.normalizePhone(phone);
    const index = this.contacts.findIndex(c => this.normalizePhone(c.phone) === normalizedPhone);
    
    if (index >= 0) {
      this.contacts[index].status = status;
      this.saveContacts();
      return true;
    }
    
    return false;
  }

  // Reset status of all contacts
  resetContactStatuses() {
    this.contacts.forEach(contact => {
      if (contact.status && contact.status !== 'Sent') {
        contact.status = 'Pending';
      }
    });
    this.saveContacts();
  }

  // Get randomized contacts for messaging (for anti-ban)
  getRandomizedContacts(count = 10) {
    const pending = this.getPendingContacts();
    
    // Shuffle the pending contacts
    const shuffled = [...pending].sort(() => 0.5 - Math.random());
    
    // Return the requested number of contacts
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  // Get stats
  getStats() {
    return {
      total: this.contacts.length,
      sent: this.contacts.filter(c => c.status === 'Sent').length,
      pending: this.contacts.filter(c => !c.status || c.status === 'Pending').length,
      failed: this.contacts.filter(c => c.status === 'Failed').length
    };
  }

  // Import contacts from Excel file
  importFromExcel(filePath) {
    try {
      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      // Process and extract contacts
      const contacts = data.map(row => {
        // Try to identify name and phone columns
        const nameKey = Object.keys(row).find(key => 
          key.toLowerCase().includes('name') || 
          key.toLowerCase() === 'contact' ||
          key.toLowerCase() === 'person'
        );
        
        const phoneKey = Object.keys(row).find(key => 
          key.toLowerCase().includes('phone') || 
          key.toLowerCase().includes('mobile') || 
          key.toLowerCase().includes('number') ||
          key.toLowerCase() === 'cell'
        );
        
        return {
          name: nameKey ? row[nameKey] : '',
          phone: phoneKey ? String(row[phoneKey]).replace(/\D/g, '') : '',
          status: 'Pending'
        };
      }).filter(contact => contact.phone);
      
      // Add the new contacts
      return this.addContacts(contacts);
    } catch (error) {
      console.error('Error importing contacts from Excel:', error);
      throw error;
    }
  }

  // Normalize phone number for comparison
  normalizePhone(phone) {
    if (!phone) return '';
    
    // Remove all non-digits
    return String(phone).replace(/\D/g, '');
  }
}

module.exports = ContactService;