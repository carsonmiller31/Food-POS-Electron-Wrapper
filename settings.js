const fs = require('fs');
const path = require('path');

class SettingsManager {
  constructor() {
    this.configPath = path.join(__dirname, 'config.json');
    this.defaults = {
      appUrl: 'http://192.168.1.186:3000',
      adminPassword: 'admin123'
    };
    this.settings = this.loadSettings();
  }

  loadSettings() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return { ...this.defaults, ...JSON.parse(data) };
      }
    } catch (error) {
      console.log('Error loading settings, using defaults:', error);
    }
    return { ...this.defaults };
  }

  saveSettings() {
    try {
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

  validatePassword(password) {
    return password === this.settings.adminPassword;
  }

  getAll() {
    return { ...this.settings };
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    return this.saveSettings();
  }

  save() {
    return this.saveSettings();
  }
}

module.exports = SettingsManager;