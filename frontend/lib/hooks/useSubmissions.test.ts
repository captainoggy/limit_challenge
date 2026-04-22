import { describe, expect, it } from 'vitest';

import { buildParams } from './useSubmissions';

describe('buildParams', () => {
  it('returns an empty object when nothing is set', () => {
    expect(buildParams({})).toEqual({});
  });

  it('passes through every filter when provided', () => {
    const params = buildParams({
      status: 'new',
      brokerId: '3',
      companySearch: 'acme',
      createdFrom: '2026-04-01T00:00:00Z',
      createdTo: '2026-04-21T23:59:59Z',
      hasDocuments: true,
      hasNotes: false,
      page: 2,
    });
    expect(params).toEqual({
      status: 'new',
      brokerId: '3',
      companySearch: 'acme',
      createdFrom: '2026-04-01T00:00:00Z',
      createdTo: '2026-04-21T23:59:59Z',
      hasDocuments: true,
      hasNotes: false,
      page: 2,
    });
  });

  it('omits page when it is 1 so the URL stays clean', () => {
    expect(buildParams({ page: 1 }).page).toBeUndefined();
  });

  it('omits undefined booleans but preserves explicit false', () => {
    // hasDocuments is not set -> should be omitted
    const omitted = buildParams({});
    expect('hasDocuments' in omitted).toBe(false);

    // hasDocuments is explicitly false -> should be preserved
    const preserved = buildParams({ hasDocuments: false });
    expect(preserved.hasDocuments).toBe(false);
  });

  it('omits empty strings', () => {
    const params = buildParams({ companySearch: '', brokerId: '' });
    expect(params).toEqual({});
  });

  it('omits pageSize when it equals the default so the URL stays clean', () => {
    expect(buildParams({ pageSize: 10 }).pageSize).toBeUndefined();
  });

  it('forwards a non-default pageSize', () => {
    expect(buildParams({ pageSize: 50 }).pageSize).toBe(50);
  });
});
