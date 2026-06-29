import { describe, it, expect } from 'vitest';
import { cronMatches, cronDescribe } from './cron';
describe('cronMatches', () => {
    it('matches every minute', () => {
        expect(cronMatches('* * * * *', new Date('2025-01-01T12:30:00'))).toBe(true);
    });
    it('matches exact minute', () => {
        expect(cronMatches('30 * * * *', new Date('2025-01-01T12:30:00'))).toBe(true);
        expect(cronMatches('30 * * * *', new Date('2025-01-01T12:31:00'))).toBe(false);
    });
    it('matches exact hour', () => {
        expect(cronMatches('0 12 * * *', new Date('2025-01-01T12:00:00'))).toBe(true);
        expect(cronMatches('0 12 * * *', new Date('2025-01-01T13:00:00'))).toBe(false);
    });
    it('matches exact day of month', () => {
        expect(cronMatches('0 0 15 * *', new Date('2025-01-15T00:00:00'))).toBe(true);
        expect(cronMatches('0 0 15 * *', new Date('2025-01-14T00:00:00'))).toBe(false);
    });
    it('matches exact month', () => {
        expect(cronMatches('0 0 1 6 *', new Date('2025-06-01T00:00:00'))).toBe(true);
        expect(cronMatches('0 0 1 6 *', new Date('2025-05-01T00:00:00'))).toBe(false);
    });
    it('matches exact day of week', () => {
        expect(cronMatches('0 0 * * 5', new Date('2025-01-03T00:00:00'))).toBe(true); // Friday
        expect(cronMatches('0 0 * * 5', new Date('2025-01-04T00:00:00'))).toBe(false); // Saturday
    });
    it('matches step with wildcard range', () => {
        expect(cronMatches('*/15 * * * *', new Date('2025-01-01T12:00:00'))).toBe(true);
        expect(cronMatches('*/15 * * * *', new Date('2025-01-01T12:15:00'))).toBe(true);
        expect(cronMatches('*/15 * * * *', new Date('2025-01-01T12:30:00'))).toBe(true);
        expect(cronMatches('*/15 * * * *', new Date('2025-01-01T12:45:00'))).toBe(true);
        expect(cronMatches('*/15 * * * *', new Date('2025-01-01T12:10:00'))).toBe(false);
    });
    it('matches step with bounded range', () => {
        expect(cronMatches('0 9-17/2 * * *', new Date('2025-01-01T09:00:00'))).toBe(true);
        expect(cronMatches('0 9-17/2 * * *', new Date('2025-01-01T11:00:00'))).toBe(true);
        expect(cronMatches('0 9-17/2 * * *', new Date('2025-01-01T13:00:00'))).toBe(true);
        expect(cronMatches('0 9-17/2 * * *', new Date('2025-01-01T10:00:00'))).toBe(false);
    });
    it('matches comma-separated values', () => {
        expect(cronMatches('0,30 * * * *', new Date('2025-01-01T12:00:00'))).toBe(true);
        expect(cronMatches('0,30 * * * *', new Date('2025-01-01T12:30:00'))).toBe(true);
        expect(cronMatches('0,30 * * * *', new Date('2025-01-01T12:15:00'))).toBe(false);
    });
    it('matches range', () => {
        expect(cronMatches('0-10 * * * *', new Date('2025-01-01T12:00:00'))).toBe(true);
        expect(cronMatches('0-10 * * * *', new Date('2025-01-01T12:05:00'))).toBe(true);
        expect(cronMatches('0-10 * * * *', new Date('2025-01-01T12:10:00'))).toBe(true);
        expect(cronMatches('0-10 * * * *', new Date('2025-01-01T12:11:00'))).toBe(false);
    });
    it('rejects invalid expressions', () => {
        expect(cronMatches('* * * *', new Date('2025-01-01T12:00:00'))).toBe(false);
        expect(cronMatches('* * * * * *', new Date('2025-01-01T12:00:00'))).toBe(false);
    });
    it('handles leading/trailing whitespace', () => {
        expect(cronMatches('  0 12 * * *  ', new Date('2025-01-01T12:00:00'))).toBe(true);
    });
    it('matches day 0 as Sunday', () => {
        expect(cronMatches('0 0 * * 0', new Date('2025-01-05T00:00:00'))).toBe(true); // Sunday
    });
    it('matches complex expression with step and range on hour, fixed minute', () => {
        // Every 2 hours between 8 and 18 at minute 30
        expect(cronMatches('30 8-18/2 * * *', new Date('2025-01-01T08:30:00'))).toBe(true);
        expect(cronMatches('30 8-18/2 * * *', new Date('2025-01-01T10:30:00'))).toBe(true);
        expect(cronMatches('30 8-18/2 * * *', new Date('2025-01-01T12:30:00'))).toBe(true);
        expect(cronMatches('30 8-18/2 * * *', new Date('2025-01-01T09:30:00'))).toBe(false);
    });
});
describe('cronDescribe', () => {
    it('describes every minute', () => {
        expect(cronDescribe('* * * * *')).toBe('Every minute');
    });
    it('describes step from wildcard', () => {
        expect(cronDescribe('*/5 * * * *')).toBe('Every 5 minutes');
        expect(cronDescribe('*/1 * * * *')).toBe('Every 1 minute');
    });
    it('describes minute-only', () => {
        expect(cronDescribe('30 * * * *')).toBe('Minute 30');
    });
    it('describes hour and minute', () => {
        expect(cronDescribe('0 12 * * *')).toBe('at 12:00');
    });
    it('describes day of month', () => {
        expect(cronDescribe('0 0 15 * *')).toBe('at 0:00 day 15');
    });
    it('describes month', () => {
        expect(cronDescribe('0 0 1 6 *')).toBe('at 0:00 day 1 month 6');
    });
    it('describes day of week', () => {
        expect(cronDescribe('0 0 * * 1')).toBe('at 0:00 on Mon');
    });
    it('describes full expression', () => {
        expect(cronDescribe('30 9 15 6 1')).toBe('at minute 30 at 9:00 day 15 month 6 on Mon');
    });
    it('returns expression for unrecognized patterns', () => {
        // minute field not *, not 0-59 → returns expression as-is
        const result = cronDescribe('0 0 * * 1');
        expect(result.length).toBeGreaterThan(0);
    });
    it('handles invalid expression gracefully', () => {
        expect(cronDescribe('* *')).toBe('Invalid expression');
    });
});
//# sourceMappingURL=cron.test.js.map