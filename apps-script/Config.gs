/**
 * Monefy Backend - Apps Script
 * Config.gs - Constants, Sheet Names, and Column Schemas
 */

var CONFIG = {
  VERSION: '1.0.0',
  DEFAULT_SPREADSHEET_NAME: 'Monefy_Finanzas_Personal',
  DEFAULT_DRIVE_FOLDER_NAME: 'Monefy_Tickets_Archivos',
  
  SHEETS: {
    CONFIGURACION: 'CONFIGURACION',
    USUARIOS: 'USUARIOS',
    CUENTAS: 'CUENTAS',
    TARJETAS: 'TARJETAS',
    CATEGORIAS: 'CATEGORIAS',
    MOVIMIENTOS: 'MOVIMIENTOS',
    TRANSFERENCIAS: 'TRANSFERENCIAS',
    RECURRENTES: 'RECURRENTES',
    PRESUPUESTOS: 'PRESUPUESTOS',
    TICKETS: 'TICKETS',
    SINCRONIZACION: 'SINCRONIZACION'
  },

  // Column definitions for each sheet (First row is always header)
  COLUMNS: {
    CONFIGURACION: ['key', 'value', 'updatedAt'],
    USUARIOS: ['id', 'name', 'email', 'role', 'createdAt', 'updatedAt', 'isDeleted'],
    CUENTAS: ['id', 'name', 'initialBalance', 'type', 'color', 'icon', 'createdAt', 'updatedAt', 'isDeleted', 'createdByUserId', 'updatedByUserId', 'createdByDeviceId', 'updatedByDeviceId'],
    TARJETAS: ['id', 'accountId', 'name', 'last4', 'type', 'color', 'icon', 'createdAt', 'updatedAt', 'isDeleted', 'createdByUserId', 'updatedByUserId', 'createdByDeviceId', 'updatedByDeviceId'],
    CATEGORIAS: ['id', 'name', 'icon', 'color', 'type', 'createdAt', 'updatedAt', 'isDeleted', 'createdByUserId', 'updatedByUserId', 'createdByDeviceId', 'updatedByDeviceId'],
    MOVIMIENTOS: ['id', 'date', 'amount', 'type', 'description', 'categoryId', 'accountId', 'cardId', 'notes', 'ticketId', 'createdAt', 'updatedAt', 'isDeleted', 'createdByUserId', 'updatedByUserId', 'createdByDeviceId', 'updatedByDeviceId'],
    TRANSFERENCIAS: ['id', 'fromAccountId', 'toAccountId', 'amount', 'date', 'description', 'createdAt', 'updatedAt', 'isDeleted', 'createdByUserId', 'updatedByUserId', 'createdByDeviceId', 'updatedByDeviceId'],
    RECURRENTES: ['id', 'name', 'amount', 'type', 'categoryId', 'accountId', 'cardId', 'frequency', 'intervalDays', 'startDate', 'nextDueDate', 'lastGeneratedDate', 'occurrencesGenerated', 'createdAt', 'updatedAt', 'isDeleted', 'createdByUserId', 'updatedByUserId', 'createdByDeviceId', 'updatedByDeviceId'],
    PRESUPUESTOS: ['id', 'categoryId', 'amount', 'period', 'startDate', 'endDate', 'createdAt', 'updatedAt', 'isDeleted', 'createdByUserId', 'updatedByUserId', 'createdByDeviceId', 'updatedByDeviceId'],
    TICKETS: ['id', 'movementId', 'fileName', 'mimeType', 'fileSize', 'driveFileId', 'driveUrl', 'status', 'createdAt', 'updatedAt', 'isDeleted', 'createdByUserId', 'updatedByUserId', 'createdByDeviceId', 'updatedByDeviceId'],
    SINCRONIZACION: ['syncId', 'deviceId', 'userId', 'timestamp', 'operationsCount', 'status', 'details']
  }
};
