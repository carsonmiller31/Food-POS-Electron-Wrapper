const fs = require('fs');
const path = require('path');
const { checkNewAppUrl, checkNewPassword, hashPassword, verifyPassword } = require('./kiosk-security');

class SettingsManager {
  constructor({ userDataDir = require('electron').app.getPath('userData') } = {}) {
    // Store settings in user-writable location
    this.configPath = path.join(userDataDir, 'config.json');
    this.legacyConfigPath = path.join(__dirname, 'config.json');

    this.defaults = {
      appUrl: 'https://kitchen-pos.systems.royaltheaters.com',
      hasSeenDriverPrompt: false,
      driverInstalled: false
    };

    // Retired production URLs. Kiosks that saved one of these get moved
    // to the current default on startup.
    this.retiredAppUrls = [
      'https://food-pos.royaltheaters-systems.com',
      'https://food-pos-system-neon.vercel.app'
    ];

    this.settings = this.loadSettings();
    this.migrateRetiredAppUrl();
    this.migrateAdminPassword();
  }

  migrateRetiredAppUrl() {
    const saved = String(this.settings.appUrl || '').trim().replace(/\/+$/, '');
    if (this.retiredAppUrls.includes(saved)) {
      console.log(`Migrating appUrl from ${saved} to ${this.defaults.appUrl}`);
      this.settings.appUrl = this.defaults.appUrl;
      this.saveSettings();
    }
  }

  loadSettings() {
    try {
      // Ensure directory exists
      fs.mkdirSync(path.dirname(this.configPath), { recursive: true });

      // Prefer current config path
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return { ...this.defaults, ...JSON.parse(data) };
      }

      // Migrate from legacy config (pre-1.0.9) if present
      if (fs.existsSync(this.legacyConfigPath)) {
        const legacyData = fs.readFileSync(this.legacyConfigPath, 'utf8');
        const merged = { ...this.defaults, ...JSON.parse(legacyData) };
        // Save migrated data to userData config path
        fs.writeFileSync(this.configPath, JSON.stringify(merged, null, 2));
        return merged;
      }
    } catch (error) {
      console.log('Error loading settings, using defaults:', error);
    }
    return { ...this.defaults };
  }

  saveSettings() {
    try {
      // Ensure directory exists
      fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(this.settings, null, 2));
      return true;
    } catch (error) {
      console.log('Error saving settings:', error);
      return false;
    }
  }

  get(key) {
    return this.settings[key];
  }

  set(key, value) {
    this.settings[key] = value;
    return this.saveSettings();
  }

  // Older builds saved the password in plain text. It keeps working, stored as a
  // hash, with no prompt to change it.
  migrateAdminPassword() {
    const plain = this.settings.adminPassword;
    if (plain === undefined) return;
    if (typeof plain === 'string' && plain && !this.settings.adminPasswordHash) {
      this.settings.adminPasswordHash = hashPassword(plain);
    }
    delete this.settings.adminPassword;
    this.saveSettings();
  }

  hasPassword() {
    return !!this.settings.adminPasswordHash;
  }

  validatePassword(password) {
    return verifyPassword(password, this.settings.adminPasswordHash);
  }

  setPassword(password) {
    const check = checkNewPassword(password);
    if (!check.ok) return check;
    this.settings.adminPasswordHash = hashPassword(password);
    return this.saveSettings() ? { ok: true } : { ok: false, error: 'Could not save the password.' };
  }

  getAll() {
    return { ...this.settings };
  }

  // Only the two values the admin panel edits can be changed here.
  updateSettings(newSettings) {
    const { appUrl, adminPassword } = newSettings || {};
    if (appUrl !== undefined && appUrl !== this.settings.appUrl) {
      const check = checkNewAppUrl(appUrl);
      if (!check.ok) return check;
    }
    if (adminPassword !== undefined) {
      const check = checkNewPassword(adminPassword);
      if (!check.ok) return check;
    }
    if (appUrl !== undefined) this.settings.appUrl = appUrl.trim();
    if (adminPassword !== undefined) return this.setPassword(adminPassword);
    return this.saveSettings() ? { ok: true } : { ok: false, error: 'Could not save settings.' };
  }

  save() {
    return this.saveSettings();
  }
}

module.exports = SettingsManager;