import { boundingBox, haversineKm, parseGeoQuery } from '../../src/common/geo';

describe('geo helpers', () => {
  it('haversine Tehran-Karaj is roughly 40km', () => {
    // Tehran ~35.6892,51.3890 — Karaj ~35.8400,50.9391
    const d = haversineKm(35.6892, 51.389, 35.84, 50.9391);
    expect(d).toBeGreaterThan(30);
    expect(d).toBeLessThan(55);
  });

  it('haversine same point is ~0', () => {
    expect(haversineKm(35.7, 51.4, 35.7, 51.4)).toBeLessThan(0.001);
  });

  it('boundingBox expands around center', () => {
    const box = boundingBox(35.7, 51.4, 10);
    expect(box.minLat).toBeLessThan(35.7);
    expect(box.maxLat).toBeGreaterThan(35.7);
    expect(box.minLng).toBeLessThan(51.4);
    expect(box.maxLng).toBeGreaterThan(51.4);
  });

  it('parseGeoQuery validates and clamps radius', () => {
    expect(parseGeoQuery({ lat: '35.7', lng: '51.4', radiusKm: '5' })).toEqual({
      lat: 35.7,
      lng: 51.4,
      radiusKm: 5,
    });
    expect(parseGeoQuery({ lat: '35.7', lng: '51.4', radiusKm: '9999' })?.radiusKm).toBe(200);
    expect(parseGeoQuery({ lat: '91', lng: '51' })).toBeNull();
    expect(parseGeoQuery({ lat: 'x', lng: '51' })).toBeNull();
  });
});
