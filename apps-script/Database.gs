/**
 * Monefy Backend - Apps Script
 * Database.gs - Google Sheets operations, UUID lookups, and non-destructive sync
 */

var Database = {
  /**
   * Get spreadsheet by ID or create default if not provided
   */
  getSpreadsheet: function(spreadsheetId) {
    if (spreadsheetId) {
      return SpreadsheetApp.openById(spreadsheetId);
    }
    // Check script properties or create new
    var props = PropertiesService.getScriptProperties();
    var defaultId = props.getProperty('DEFAULT_SPREADSHEET_ID');
    if (defaultId) {
      try {
        return SpreadsheetApp.openById(defaultId);
      } catch (e) {
        // May have been deleted or unshared
      }
    }
    
    // Create new spreadsheet
    var ss = SpreadsheetApp.create(CONFIG.DEFAULT_SPREADSHEET_NAME);
    props.setProperty('DEFAULT_SPREADSHEET_ID', ss.getId());
    this.initializeSheets(ss);
    return ss;
  },

  /**
   * Initialize all sheets with proper headers and structure
   */
  initializeSheets: function(ss) {
    var sheetNames = Object.keys(CONFIG.SHEETS);
    
    sheetNames.forEach(function(key) {
      var sheetName = CONFIG.SHEETS[key];
      var sheet = ss.getSheetByName(sheetName);
      var columns = CONFIG.COLUMNS[key];

      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }

      // Check if header row exists
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();

      if (lastRow === 0 || lastCol === 0) {
        // Insert headers
        sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
        sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold').setBackground('#10b981').setFontColor('#ffffff');
        sheet.setFrozenRows(1);
      } else {
        // Ensure columns match
        var existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        if (existingHeaders.length < columns.length) {
          // Add missing header columns
          sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
        }
      }
    });

    // Remove default "Sheet1" or "Hoja 1" if other sheets exist
    var defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Hoja 1');
    if (defaultSheet && ss.getSheets().length > 1) {
      try {
        ss.deleteSheet(defaultSheet);
      } catch (e) {}
    }

    return ss;
  },

  /**
   * Find row index by UUID in column 1 (A)
   * Returns row number (1-indexed) or -1 if not found
   */
  findRowIndexById: function(sheet, id) {
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return -1;

    // Read column A
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id)) {
        return i + 2; // +2 for 1-based index and header offset
      }
    }
    return -1;
  },

  /**
   * Upsert record by UUID - NEVER destructive clear+write
   */
  upsertRecord: function(ss, sheetName, record) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      this.initializeSheets(ss);
      sheet = ss.getSheetByName(sheetName);
    }

    var columns = CONFIG.COLUMNS[sheetName];
    if (!columns) {
      throw new Error('Esquema no definido para la hoja ' + sheetName);
    }

    var validatedRecord = Validation.validateEntity(sheetName, record);
    var rowIndex = this.findRowIndexById(sheet, validatedRecord.id);

    // Build row values according to header column order
    var rowValues = columns.map(function(col) {
      var val = validatedRecord[col];
      if (val === undefined || val === null) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return val;
    });

    if (rowIndex > 1) {
      // Update existing row
      sheet.getRange(rowIndex, 1, 1, columns.length).setValues([rowValues]);
    } else {
      // Append as new row
      sheet.appendRow(rowValues);
    }

    return validatedRecord;
  },

  /**
   * Soft delete record (sets isDeleted=true and updatedAt)
   */
  softDeleteRecord: function(ss, sheetName, id, userId, deviceId) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return false;

    var rowIndex = this.findRowIndexById(sheet, id);
    if (rowIndex < 2) return false;

    var columns = CONFIG.COLUMNS[sheetName];
    var isDeletedCol = columns.indexOf('isDeleted') + 1;
    var updatedAtCol = columns.indexOf('updatedAt') + 1;
    var updatedByUserIdCol = columns.indexOf('updatedByUserId') + 1;
    var updatedByDeviceIdCol = columns.indexOf('updatedByDeviceId') + 1;

    var now = new Date().toISOString();

    if (isDeletedCol > 0) sheet.getRange(rowIndex, isDeletedCol).setValue(true);
    if (updatedAtCol > 0) sheet.getRange(rowIndex, updatedAtCol).setValue(now);
    if (updatedByUserIdCol > 0 && userId) sheet.getRange(rowIndex, updatedByUserIdCol).setValue(userId);
    if (updatedByDeviceIdCol > 0 && deviceId) sheet.getRange(rowIndex, updatedByDeviceIdCol).setValue(deviceId);

    return true;
  },

  /**
   * Read all records from a sheet with optional updatedSince filter
   */
  readAllRecords: function(ss, sheetName, updatedSince) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol === 0) return [];

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    var results = [];
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var record = {};
      var hasId = false;

      for (var j = 0; j < headers.length; j++) {
        var key = headers[j];
        var val = row[j];

        if (key === 'id' && val) hasId = true;

        if (key === 'isDeleted') {
          record[key] = (val === true || String(val).toLowerCase() === 'true');
        } else if (key === 'amount' || key === 'initialBalance' || key === 'fileSize' || key === 'intervalDays') {
          record[key] = (val === '' || val === null) ? 0 : Number(val);
        } else if (key === 'occurrencesGenerated' && typeof val === 'string' && val.startsWith('[')) {
          try {
            record[key] = JSON.parse(val);
          } catch(e) {
            record[key] = [];
          }
        } else {
          record[key] = val;
        }
      }

      if (hasId && (!updatedSince || !record.updatedAt || record.updatedAt >= updatedSince)) {
        results.push(record);
      }
    }

    return results;
  }
};
