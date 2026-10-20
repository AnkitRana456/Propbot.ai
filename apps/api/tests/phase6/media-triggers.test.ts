import { describe, it, expect } from 'vitest';
import {
  detectMediaKinds,
  buildMediaItems,
  buildMapEmbedUrl,
  requestedBhk,
  type MediaProject,
} from '../../src/modules/chat/media-triggers.js';

const project: MediaProject = {
  name: 'Lakeside',
  highlightPhotos: ['https://cdn.example.com/h1.jpg', 'http://insecure.example.com/h2.jpg'],
  gallery: ['https://cdn.example.com/g1.jpg', 'https://cdn.example.com/g2.jpg'],
  floorPlans: [
    { title: '2BHK Type A', bhk: 2, carpetAreaSqft: 850, planUrl: 'https://cdn.example.com/2a.png' },
    { title: '3BHK Type B', bhk: 3, carpetAreaSqft: 1200, planUrl: 'https://cdn.example.com/3b.png' },
    { title: 'Bad', bhk: 3, planUrl: 'javascript:alert(1)' },
  ],
  masterPlanUrl: 'https://cdn.example.com/master.png',
  mapUrl: null,
  latitude: 12.9716,
  longitude: 77.5946,
};

describe('media triggers: keyword sets', () => {
  it('floor plans', () => {
    for (const msg of ['show me the 2bhk', '3 BHK options?', 'what is the carpet area', 'send floor plan', 'floorplans please', 'any layout available']) {
      expect(detectMediaKinds(msg, false), msg).toContain('floor_plan');
    }
  });

  it('master plans (and "project layout" is NOT also a floor-plan request)', () => {
    for (const msg of ['can I see the master plan', 'site plan please', 'share the project layout']) {
      expect(detectMediaKinds(msg, false), msg).toContain('master_plan');
    }
    expect(detectMediaKinds('share the project layout', false)).not.toContain('floor_plan');
    expect(detectMediaKinds('2bhk layout and master plan', false)).toEqual(['floor_plan', 'master_plan']);
  });

  it('location map', () => {
    for (const msg of ['what is the location', 'directions to the site', 'where is it', 'how to reach the project']) {
      expect(detectMediaKinds(msg, false), msg).toContain('location_map');
    }
  });

  it('first message auto-shows highlights; later messages and unrelated text do not', () => {
    expect(detectMediaKinds('hello', true)).toEqual(['highlight_photos']);
    expect(detectMediaKinds('hello', false)).toEqual([]);
    expect(detectMediaKinds('what are the payment terms', false)).toEqual([]);
  });
});

describe('media items', () => {
  it('highlights: https only, dedicated photos win over the gallery', () => {
    const [item] = buildMediaItems(['highlight_photos'], project, 'hi');
    expect(item!.urls).toEqual(['https://cdn.example.com/h1.jpg']);
    const [fallback] = buildMediaItems(['highlight_photos'], { ...project, highlightPhotos: [] }, 'hi');
    expect(fallback!.urls).toEqual(['https://cdn.example.com/g1.jpg', 'https://cdn.example.com/g2.jpg']);
  });

  it('floor plans: matches the requested BHK and drops unsafe URLs', () => {
    expect(requestedBhk('i want a 3 bhk')).toBe(3);
    const [item] = buildMediaItems(['floor_plan'], project, 'show 3bhk');
    expect(item!.urls).toEqual(['https://cdn.example.com/3b.png']);
    expect(item!.caption).toContain('1200 sq ft');
    const [all] = buildMediaItems(['floor_plan'], project, 'floor plan');
    expect(all!.urls).toEqual(['https://cdn.example.com/2a.png', 'https://cdn.example.com/3b.png']);
  });

  it('master plan and map embed', () => {
    expect(buildMediaItems(['master_plan'], project, 'master plan')[0]!.urls).toEqual(['https://cdn.example.com/master.png']);
    const [map] = buildMediaItems(['location_map'], project, 'where');
    expect(map!.embedUrl).toBe('https://www.google.com/maps?q=12.9716,77.5946&output=embed');
  });

  it('only Google Maps embeds are allowed; missing media produces no item', () => {
    expect(buildMapEmbedUrl({ mapUrl: 'https://evil.example.com/embed?x', latitude: null, longitude: null })).toBeNull();
    expect(buildMapEmbedUrl({ mapUrl: 'https://www.google.com/maps/embed?pb=!1m18', latitude: null, longitude: null })).toBe(
      'https://www.google.com/maps/embed?pb=!1m18',
    );
    const empty: MediaProject = { ...project, highlightPhotos: [], gallery: [], floorPlans: [], masterPlanUrl: null, latitude: null, longitude: null };
    expect(buildMediaItems(['highlight_photos', 'floor_plan', 'master_plan', 'location_map'], empty, 'x')).toEqual([]);
  });
});
