/**
 * Monefy Backend - Apps Script
 * Drive.gs - Google Drive folder and ticket receipts handling
 */

var Drive = {
  /**
   * Get or create folder in user's Google Drive
   */
  getOrCreateFolder: function(folderId, folderName) {
    if (folderId) {
      try {
        return DriveApp.getFolderById(folderId);
      } catch (e) {
        // Folder might be inaccessible
      }
    }

    var targetName = folderName || CONFIG.DEFAULT_DRIVE_FOLDER_NAME;
    var folders = DriveApp.getFoldersByName(targetName);
    if (folders.hasNext()) {
      return folders.next();
    }

    return DriveApp.createFolder(targetName);
  },

  /**
   * Upload ticket / receipt image to Google Drive
   */
  uploadTicket: function(folderId, fileName, mimeType, base64Data) {
    if (!base64Data) {
      throw new Error('No se proporcionaron datos de imagen en base64');
    }

    var folder = this.getOrCreateFolder(folderId);
    
    // Strip data URL prefix if present (e.g., "data:image/jpeg;base64,")
    var cleanBase64 = base64Data;
    if (cleanBase64.indexOf(',') > -1) {
      cleanBase64 = cleanBase64.split(',')[1];
    }

    var decodedBytes = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decodedBytes, mimeType || 'image/jpeg', fileName || ('ticket_' + new Date().getTime() + '.jpg'));

    var file = folder.createFile(blob);
    
    // Optionally make viewable with link
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(e) {}

    return {
      fileId: file.getId(),
      webViewLink: file.getUrl(),
      size: file.getSize(),
      name: file.getName()
    };
  }
};
