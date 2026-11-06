/**
 * API / app version constants (Beautijoo).
 *
 * Path prefix remains `/api/v1`. Breaking changes ship as `/api/v2` later.
 * Non-breaking additions stay on v1. See docs/API_VERSIONING.md.
 */

/** Major API surface version exposed under `/api/v{N}` */
export const API_VERSION = '1';

/** Label used in headers and health */
export const API_VERSION_LABEL = `v${API_VERSION}`;

/** Application release version (align with root package.json) */
export const APP_VERSION =
  (process.env.APP_VERSION || process.env.npm_package_version || '3.0.0').trim();

/** Response header names */
export const HDR_API_VERSION = 'X-API-Version';
export const HDR_APP_VERSION = 'X-App-Version';
