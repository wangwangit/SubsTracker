// @ts-check
import { describe, expect, it } from 'vitest';
import adminPage from '../../src/views/adminPage.html';

describe('admin page subscription list', () => {
  it('re-renders the subscription table when the lunar display checkbox changes', () => {
    expect(adminPage).toMatch(
      /listShowLunar\.addEventListener\(['"]change['"],\s*handleListLunarToggle\)/
    );
  });
});
