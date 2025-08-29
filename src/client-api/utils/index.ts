import { Request } from 'express';

/**
 * Extracts the real IP address from an Express request object.
 * It checks various headers that may contain the real IP address,
 * such as 'x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', and 'x-connecting-ip'.
 *
 * @param {Request} req - The Express request object.
 * @returns {string} - The real IP address or 'unknown' if not found.
 */
export const getRealIp = (req: Request): string => {
  // Try to get real IP from various headers
  const xForwardedFor = req.headers['x-forwarded-for'];
  const xRealIp = req.headers['x-real-ip'];
  const cfConnectingIp = req.headers['cf-connecting-ip'];
  const xConnectingIp = req.headers['x-connecting-ip'];

  // Return first valid IP found
  if (cfConnectingIp && typeof cfConnectingIp === 'string') {
    return cfConnectingIp;
  }
  if (xConnectingIp && typeof xConnectingIp === 'string') {
    return xConnectingIp;
  }
  if (xRealIp && typeof xRealIp === 'string') {
    return xRealIp;
  }
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, get the first one
    const forwarded = Array.isArray(xForwardedFor)
      ? xForwardedFor[0]
      : xForwardedFor;
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  // Fallback to connection IP
  return req.ip || 'unknown';
};
