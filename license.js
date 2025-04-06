// Add these global variables
let isLicenseValid = false;
let demoMode = false;
let demoMessagesRemaining = 10;

// Add these DOM elements to your list of elements
const licenseOverlay = document.getElementById('licenseOverlay');
const licenseKey = document.getElementById('licenseKey');
const activateLicenseBtn = document.getElementById('activateLicenseBtn');
const demoModeBtn = document.getElementById('demoModeBtn');
const licenseKeySettings = document.getElementById('licenseKeySettings');
const showHideLicenseBtn = document.getElementById('showHideLicenseBtn');
const deactivateLicenseBtn = document.getElementById('deactivateLicenseBtn');
const updateLicenseBtn = document.getElementById('updateLicenseBtn');
const licenseStatusDisplay = document.getElementById('licenseStatusDisplay');

// Add these to the setupEventListeners function
function setupLicenseEventListeners() {
  // License activation
  activateLicenseBtn.addEventListener('click', handleActivateLicense);
  demoModeBtn.addEventListener('click', handleDemoMode);
  showHideLicenseBtn.addEventListener('click', toggleLicenseKeyVisibility);
  deactivateLicenseBtn.addEventListener('click', handleDeactivateLicense);
  updateLicenseBtn.addEventListener('click', handleUpdateLicense);
  
  // Add IPC listeners
  ipcRenderer.on('license-status', (event, status) => {
    updateLicenseState(status.isValid);
  });
}



// License Handlers
async function handleActivateLicense() {
  const key = licenseKey.value.trim();
  
  if (!key) {
    logMessage('Please enter a valid license key', 'error');
    return;
  }
  
  try {
    logMessage('Validating license key...', 'info');
    
    const result = await ipcRenderer.invoke('validate-license', key);
    
    if (result.success) {
      logMessage(result.message, 'success');
      updateLicenseState(true);
    } else {
      logMessage(result.message, 'error');
    }
  } catch (error) {
    logMessage(`Error validating license: ${error.message}`, 'error');
  }
}

function handleDemoMode() {
  demoMode = true;
  demoMessagesRemaining = 10;
  licenseOverlay.style.display = 'none';
  
  // Add demo mode banner
  addDemoModeBanner();
  
  logMessage('Demo mode activated. You can send up to 10 messages.', 'info');
}

function addDemoModeBanner() {
  const banner = document.createElement('div');
  banner.className = 'demo-mode-banner';
  banner.innerHTML = `
    <div>DEMO MODE: <span class="demo-mode-counter">${demoMessagesRemaining} messages remaining</span></div>
    <div class="demo-upgrade-button" id="upgradeFromDemo">Upgrade Now</div>
  `;
  
  document.body.insertBefore(banner, document.body.firstChild);
  
  // Add event listener to upgrade button
  document.getElementById('upgradeFromDemo').addEventListener('click', () => {
    licenseOverlay.style.display = 'flex';
  });
}

function updateDemoCounter() {
  if (demoMode) {
    demoMessagesRemaining--;
    
    // Update counter in banner
    const counter = document.querySelector('.demo-mode-counter');
    if (counter) {
      counter.textContent = `${demoMessagesRemaining} messages remaining`;
    }
    
    // Check if limit reached
    if (demoMessagesRemaining <= 0) {
      logMessage('Demo message limit reached. Please activate a license to continue.', 'error');
      
      // Show license overlay
      licenseOverlay.style.display = 'flex';
    }
  }
}

async function handleDeactivateLicense() {
  if (confirm('Are you sure you want to deactivate your license? You will need to enter a new license key to use the application.')) {
    try {
      const result = await ipcRenderer.invoke('clear-license');
      
      if (result.success) {
        logMessage(result.message, 'success');
        updateLicenseState(false);
      } else {
        logMessage(result.message, 'error');
      }
    } catch (error) {
      logMessage(`Error deactivating license: ${error.message}`, 'error');
    }
  }
}

async function handleUpdateLicense() {
  const newLicenseKey = prompt('Enter your new license key:');
  
  if (!newLicenseKey) {
    return;
  }
  
  try {
    const result = await ipcRenderer.invoke('validate-license', newLicenseKey);
    
    if (result.success) {
      logMessage(result.message, 'success');
      updateLicenseState(true);
    } else {
      logMessage(result.message, 'error');
    }
  } catch (error) {
    logMessage(`Error updating license: ${error.message}`, 'error');
  }
}

function toggleLicenseKeyVisibility() {
  if (licenseKeySettings.type === 'password') {
    licenseKeySettings.type = 'text';
    showHideLicenseBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
  } else {
    licenseKeySettings.type = 'password';
    showHideLicenseBtn.innerHTML = '<i class="fas fa-eye"></i>';
  }
}

function updateLicenseState(isValid) {
  isLicenseValid = isValid;
  
  // Hide/show license overlay
  licenseOverlay.style.display = isValid || demoMode ? 'none' : 'flex';
  
  // Update license settings display
  licenseStatusDisplay.innerHTML = isValid 
    ? '<div class="license-status-active"><i class="fas fa-check-circle"></i> License Active</div>'
    : '<div class="license-status-inactive"><i class="fas fa-times-circle"></i> License Inactive</div>';
  
  // Update license key field in settings
  licenseKeySettings.value = isValid ? '●●●●●●●●●●●●●●●●●●●●' : '';
  
  // Update UI state
  updateUI();
  
  // If demo mode banner is needed and not present
  if (demoMode && !document.querySelector('.demo-mode-banner')) {
    addDemoModeBanner();
  }
}

// Modify the handleSendMessage function to handle demo mode
function handleSendMessage() {
  const selectedContactId = contactSelect.value;
  const message = messageInput.value.trim();
  
  if (!selectedContactId || !message) {
    logMessage('Please select a contact and enter a message', 'error');
    return;
  }
  
  // Check if we're in demo mode and have messages remaining
  if (demoMode && demoMessagesRemaining <= 0) {
    logMessage('Demo message limit reached. Please activate a license to continue.', 'error');
    licenseOverlay.style.display = 'flex';
    return;
  }
  
  const contact = contacts.find(c => c.phone === selectedContactId);
  
  if (!contact) {
    logMessage('Selected contact not found', 'error');
    return;
  }
  
  logMessage(`Sending message to ${contact.name || contact.phone}...`, 'info');
  ipcRenderer.send('send-message', { 
    contact, 
    message,
    attachment  // Include attachment if present
  });
  
  // Decrement demo counter if in demo mode
  if (demoMode) {
    updateDemoCounter();
  }
}