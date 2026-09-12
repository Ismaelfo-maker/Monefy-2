/**
 * Monefy Backend - Apps Script
 * Sync.gs - Batch synchronization, concurrency protection, and remote delta retrieval
 */

var Sync = {
  /**
   * Process client operations queue and return remote deltas
   */
  processSync: function(ss, payload, deviceId, userId) {
    var operations = payload.operations || [];
    var lastSyncTimestamp = payload.lastSyncTimestamp || null;
    var processedOperations = [];
    var errors = [];

    // Map entity types to sheet names
    var entityToSheetMap = {
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

    // 1. Process client pending operations
    for (var i = 0; i < operations.length; i++) {
      var op = operations[i];
      var sheetName = entityToSheetMap[op.entityType];

      if (!sheetName) {
        errors.push({ opId: op.id, error: 'Tipo de entidad desconocido: ' + op.entityType });
        continue;
      }

      try {
        if (op.operation === 'CREATE' || op.operation === 'UPDATE') {
          var record = op.payload;
          record.updatedByDeviceId = deviceId;
          if (userId) record.updatedByUserId = userId;
          Database.upsertRecord(ss, sheetName, record);
          processedOperations.push(op.id);
        } else if (op.operation === 'DELETE') {
          Database.softDeleteRecord(ss, sheetName, op.entityId, userId, deviceId);
          processedOperations.push(op.id);
        }
      } catch (err) {
        errors.push({ opId: op.id, error: err.toString() });
      }
    }

    // 2. Fetch remote changes since client's lastSyncTimestamp
    var remoteChanges = {};
    var sheetKeys = Object.keys(entityToSheetMap);

    sheetKeys.forEach(function(entityKey) {
      var sheetName = entityToSheetMap[entityKey];
      remoteChanges[entityKey] = Database.readAllRecords(ss, sheetName, lastSyncTimestamp);
    });

    // 3. Log sync event to SINCRONIZACION sheet
    try {
      var syncSheet = ss.getSheetByName(CONFIG.SHEETS.SINCRONIZACION);
      if (syncSheet) {
        var syncId = 'sync_' + new Date().getTime();
        var now = new Date().toISOString();
        syncSheet.appendRow([
          syncId,
          deviceId,
          userId || 'anónimo',
          now,
          processedOperations.length,
          errors.length > 0 ? 'PARTIAL_ERROR' : 'SUCCESS',
          errors.length > 0 ? JSON.stringify(errors) : 'OK'
        ]);
      }
    } catch(e) {}

    return {
      processedOperations: processedOperations,
      errors: errors,
      serverTimestamp: new Date().toISOString(),
      remoteChanges: remoteChanges
    };
  }
};
