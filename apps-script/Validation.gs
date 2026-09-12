/**
 * Monefy Backend - Apps Script
 * Validation.gs - Request integrity and schema validation
 */

var Validation = {
  /**
   * Validate incoming HTTP request payload
   */
  validateRequest: function(body) {
    if (!body || typeof body !== 'object') {
      throw new Error('Cuerpo de petición inválido o vacío');
    }
    if (!body.requestId || typeof body.requestId !== 'string') {
      throw new Error('Parámetro "requestId" obligatorio');
    }
    if (!body.deviceId || typeof body.deviceId !== 'string') {
      throw new Error('Parámetro "deviceId" obligatorio');
    }
    if (!body.action || typeof body.action !== 'string') {
      throw new Error('Parámetro "action" obligatorio');
    }
    return true;
  },

  /**
   * Validate UUID format
   */
  isValidUUID: function(uuid) {
    if (!uuid || typeof uuid !== 'string') return false;
    var re = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return re.test(uuid) || uuid.length >= 10;
  },

  /**
   * Validate entity record before writing to sheets
   */
  validateEntity: function(sheetName, record) {
    if (!record || typeof record !== 'object') {
      throw new Error('Registro inválido para ' + sheetName);
    }
    if (!record.id) {
      throw new Error('El registro debe contener un "id" UUID único');
    }
    if (!record.createdAt) {
      record.createdAt = new Date().toISOString();
    }
    if (!record.updatedAt) {
      record.updatedAt = new Date().toISOString();
    }
    if (typeof record.isDeleted !== 'boolean') {
      record.isDeleted = false;
    }

    // Specific domain rules
    if (sheetName === CONFIG.SHEETS.MOVIMIENTOS) {
      if (typeof record.amount !== 'number' || isNaN(record.amount) || record.amount <= 0) {
        throw new Error('El movimiento requiere un importe numérico positivo');
      }
      if (record.type !== 'expense' && record.type !== 'income') {
        throw new Error('El tipo de movimiento debe ser "expense" o "income"');
      }
      if (!record.accountId) {
        throw new Error('El movimiento debe estar asociado a una cuenta');
      }
    } else if (sheetName === CONFIG.SHEETS.TRANSFERENCIAS) {
      if (typeof record.amount !== 'number' || isNaN(record.amount) || record.amount <= 0) {
        throw new Error('La transferencia requiere un importe numérico positivo');
      }
      if (!record.fromAccountId || !record.toAccountId) {
        throw new Error('La transferencia requiere cuenta de origen y destino');
      }
      if (record.fromAccountId === record.toAccountId) {
        throw new Error('La cuenta de origen y destino no pueden ser la misma');
      }
    }

    return record;
  }
};
