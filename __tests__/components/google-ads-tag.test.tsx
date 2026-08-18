import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { GoogleAdsTag } from '@/components/google-ads-tag';

afterEach(() => {
  vi.unstubAllEnvs();
});

function scriptChildren(element: React.ReactElement): React.ReactElement[] {
  const children = (element.props as { children: React.ReactElement[] }).children;
  return React.Children.toArray(children) as React.ReactElement[];
}

describe('GoogleAdsTag', () => {
  it('renders nothing when NEXT_PUBLIC_GOOGLE_ADS_ID is unset', () => {
    expect(GoogleAdsTag()).toBeNull();
  });

  it('renders the gtag loader and init scripts when the env var is set', () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-987654');
    const element = GoogleAdsTag();
    expect(element).not.toBeNull();

    const [loader, init] = scriptChildren(element!);
    expect((loader.props as { src: string }).src).toBe(
      'https://www.googletagmanager.com/gtag/js?id=AW-987654'
    );
    const inline = (init.props as { children: string }).children;
    expect(inline).toContain("gtag('config', 'AW-987654')");
    expect(inline).toContain('dataLayer');
  });
});
