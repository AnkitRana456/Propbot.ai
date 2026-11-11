import { describe, it, expect } from 'vitest';
import { bucketOf } from '../src/pages/TasksPage.js';

describe('bucketOf', () => {
  const now = new Date(2026, 10, 10, 12, 0);
  const at = (d: number, h: number) => new Date(2026, 10, d, h, 0).toISOString();

  it('sorts tasks by status and due date', () => {
    expect(bucketOf({ status: 'pending', dueDate: at(10, 9) }, now)).toBe('overdue');
    expect(bucketOf({ status: 'pending', dueDate: at(10, 18) }, now)).toBe('today');
    expect(bucketOf({ status: 'pending', dueDate: at(11, 9) }, now)).toBe('upcoming');
    expect(bucketOf({ status: 'completed', dueDate: at(1, 9) }, now)).toBe('done');
    expect(bucketOf({ status: 'cancelled', dueDate: at(10, 9) }, now)).toBeNull();
  });
});
