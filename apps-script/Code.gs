/**
 * Monefy Backend - Google Apps Script Web App Entrypoint
 * Code.gs - Dispatches incoming API actions with robust JSON responses
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'PING';
  var responseData = {
    status: 'online',
    service: 'Monefy Backend Google Apps Script API',
    version: CONFIG.VERSION,
    timestamp: new Date().toISOString(),
    action: action
  };

  if (action === 'PING') {
    return createJsonResponse(true, 'ping_' + new Date().getTime(), responseData);
  }

  // Handle GET requests if payload is provided via query parameter
  if (e && e.parameter && e.parameter.payload) {
    try {
      var body = JSON.parse(e.parameter.payload);
      return handleAction(body);
    } catch (err) {
      return createJsonResponse(false, 'get_error', null, 'Error al parsear payload: ' + err.toString());
    }
  }

  return createJsonResponse(true, 'info', responseData);
}

function doPost(e) {
  var body;
  try {
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else {
      throw new Error('No se recibieron datos en el cuerpo POST');
    }
  } catch (err) {
    return createJsonResponse(false, 'parse_error', null, 'JSON inválido: ' + err.toString());
  }

  return handleAction(body);
}

/**
 * Handle incoming parsed request body
 */
function handleAction(body) {
  var requestId = body.requestId || ('req_' + new Date().getTime());
  var timestamp = new Date().toISOString();

  try {
    Validation.validateRequest(body);

    var action = body.action;
    var payload = body.payload || {};
    var deviceId = body.deviceId;
    var userId = body.userId;
    var spreadsheetId = payload.spreadsheetId;

    var ss = Database.getSpreadsheet(spreadsheetId);

    var resultData = null;

    switch (action) {
      case 'PING':
        resultData = { pong: true, time: timestamp };
        break;

      case 'CREATE_DATABASE':
        Database.initializeSheets(ss);
        resultData = {
          spreadsheetId: ss.getId(),
          spreadsheetName: ss.getName(),
          spreadsheetUrl: ss.getUrl(),
          sheetsInitialized: Object.keys(CONFIG.SHEETS)
        };
        break;

      case 'CREATE_SPREADSHEET':
        var newTitle = payload.title || CONFIG.DEFAULT_SPREADSHEET_NAME;
        var newSs = SpreadsheetApp.create(newTitle);
        Database.initializeSheets(newSs);
        resultData = {
          spreadsheetId: newSs.getId(),
          spreadsheetName: newSs.getName(),
          spreadsheetUrl: newSs.getUrl(),
          sheetsInitialized: Object.keys(CONFIG.SHEETS)
        };
        break;

      case 'CREATE_FOLDER':
        var folderName = payload.folderName || CONFIG.DEFAULT_DRIVE_FOLDER_NAME;
        var folder = Drive.getOrCreateFolder(null, folderName);
        resultData = {
          folderId: folder.getId(),
          folderName: folder.getName(),
          folderUrl: folder.getUrl()
        };
        break;

      case 'GET_CONFIG':
        resultData = {
          spreadsheetId: ss.getId(),
          spreadsheetName: ss.getName(),
          sheets: ss.getSheets().map(function(s) { return s.getName(); }),
          version: CONFIG.VERSION
        };
        break;

      case 'GET_DATA':
        var requestedSheets = payload.sheets || Object.keys(CONFIG.SHEETS);
        var since = payload.updatedSince || null;
        var fullData = {};

        var entityMap = {
          'accounts': CONFIG.SHEETS.CUENTAS,
          'cards': CONFIG.SHEETS.TARJETAS,
          'categories': CONFIG.SHEETS.CATEGORIAS,
          'movements': CONFIG.SHEETS.MOVIMIENTOS,
          'transfers': CONFIG.SHEETS.TRANSFERENCIAS,
          'recurring': CONFIG.SHEETS.RECURRENTES,
          'budgets': CONFIG.SHEETS.PRESUPUESTOS,
          'tickets': CONFIG.SHEETS.TICKETS,
          'users': CONFIG.SHEETS.USUARIOS
        };

        Object.keys(entityMap).forEach(function(entityKey) {
          var sheetName = entityMap[entityKey];
          fullData[entityKey] = Database.readAllRecords(ss, sheetName, since);
        });

        resultData = {
          serverTimestamp: timestamp,
          records: fullData
        };
        break;

      case 'SYNC':
        resultData = Sync.processSync(ss, payload, deviceId, userId);
        break;

      case 'CREATE_RECORD':
      case 'UPDATE_RECORD':
        var entityType = payload.entityType;
        var record = payload.record;
        var sheetName = CONFIG.SHEETS[entityType.toUpperCase()] || entityType;
        resultData = Database.upsertRecord(ss, sheetName, record);
        break;

      case 'DELETE_RECORD':
        var entityType = payload.entityType;
        var recordId = payload.id;
        var sheetName = CONFIG.SHEETS[entityType.toUpperCase()] || entityType;
        var ok = Database.softDeleteRecord(ss, sheetName, recordId, userId, deviceId);
        resultData = { deleted: ok, id: recordId };
        break;

      case 'UPLOAD_TICKET':
        var folderId = payload.folderId;
        var fileName = payload.fileName;
        var mimeType = payload.mimeType;
        var base64Data = payload.dataBase64;
        var uploadResult = Drive.uploadTicket(folderId, fileName, mimeType, base64Data);
        
        // Also optionally upsert ticket record to TICKETS sheet
        if (payload.ticketRecord) {
          var ticketRecord = payload.ticketRecord;
          ticketRecord.driveFileId = uploadResult.fileId;
          ticketRecord.driveUrl = uploadResult.webViewLink;
          ticketRecord.status = 'uploaded';
          ticketRecord.updatedAt = new Date().toISOString();
          ticketRecord.updatedByDeviceId = deviceId;
          Database.upsertRecord(ss, CONFIG.SHEETS.TICKETS, ticketRecord);
        }

        resultData = uploadResult;
        break;

      default:
        throw new Error('Acción desconocida: ' + action);
    }

    return createJsonResponse(true, requestId, resultData);
  } catch (err) {
    return createJsonResponse(false, requestId, null, err.toString());
  }
}

/**
 * Creates standardized TextOutput response formatted as JSON with CORS headers
 */
function createJsonResponse(success, requestId, data, error) {
  var output = {
    success: !!success,
    requestId: requestId || 'req_' + new Date().getTime(),
    timestamp: new Date().toISOString()
  };

  if (error) {
    output.error = error;
  }
  if (data !== undefined && data !== null) {
    output.data = data;
  }

  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}
