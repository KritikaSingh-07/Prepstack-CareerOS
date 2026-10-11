const DAY = 24 * 60 * 60 * 1000;
export const STALE_AFTER_DAYS = 21;
export const CLOSING_SOON_DAYS = 7;

/**
 * Describes whether a listing can be trusted as open.
 * - closed:       explicitly closed, or the closing date has passed
 * - stale:        status has not been verified with the source recently
 * - closing_soon: closing within a week
 * - open:         recently verified and not closing soon
 */
export function freshness(job, now = new Date()) {
  const closing = job.closingDate ? new Date(job.closingDate) : null;
  const verified = job.lastVerifiedAt ? new Date(job.lastVerifiedAt) : null;
  const daysToClose = closing ? Math.ceil((closing - now) / DAY) : null;
  const daysSinceVerified = verified ? Math.floor((now - verified) / DAY) : null;

  if (job.status === 'closed' || (daysToClose !== null && daysToClose < 0)) {
    return { state: 'closed', label: 'Closed', daysToClose, daysSinceVerified };
  }
  if (daysSinceVerified === null || daysSinceVerified > STALE_AFTER_DAYS) {
    return {
      state: 'stale',
      label: daysSinceVerified === null ? 'Status unverified' : `Status unverified for ${daysSinceVerified} days`,
      warning: 'We could not confirm this listing is still open. Check the employer site before investing time.',
      daysToClose,
      daysSinceVerified,
    };
  }
  if (daysToClose !== null && daysToClose <= CLOSING_SOON_DAYS) {
    return { state: 'closing_soon', label: daysToClose === 0 ? 'Closes today' : `Closes in ${daysToClose} day${daysToClose === 1 ? '' : 's'}`, daysToClose, daysSinceVerified };
  }
  return { state: 'open', label: 'Open', daysToClose, daysSinceVerified };
}
