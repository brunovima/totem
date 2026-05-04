import { appendFileSync } from 'fs';
import { join } from 'path';

const AUDIT_LOG = join(process.cwd(), 'logs', 'audit.log');

export function logAccess(userId, action, resource, status = 'SUCCESS', metadata = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    userId,
    action,
    resource,
    status,
    ...metadata
  };

  try {
    appendFileSync(AUDIT_LOG, JSON.stringify(entry) + '\n');
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
