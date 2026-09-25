// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { summarize, localToday, type Booking } from './analytics';
const properties = [{id:'p1',name:'River Hut',published:true},{id:'p2',name:'Hill House',published:false}];
const row:Booking = {id:'b1',property_id:'p1',start_date:'2026-09-23',end_date:'2026-09-26',created_at:'2026-09-24T10:00:00Z',total_price_cents:3000000,status:'paid'};
describe('dashboard analytics',()=>{
 it('uses Pakistan dates at the UTC midnight boundary',()=>{expect(localToday(new Date('2026-09-24T20:00:00Z'))).toBe('2026-09-25');});
 it('separates confirmed value from requested/rejected bookings and scopes properties',()=>{
  const rows=[row,{...row,id:'b2',status:'requested'},{...row,id:'b3',status:'rejected'},{...row,id:'b4',property_id:'p2'}];
  const result=summarize(rows,properties,'2026-09-25',7,'p1');
  expect(result.value).toBe(3000000); expect(result.bookings).toBe(3); expect(result.published).toBe(1);
  expect(result.buckets.reduce((s,b)=>s+b.count,0)).toBe(3);
 });
 it('counts distinct occupied nights, excludes checkout day and clips to the reporting period',()=>{
  const result=summarize([row,{...row,id:'overlap'}, {...row,id:'older',start_date:'2026-09-01',end_date:'2026-09-20'}],properties,'2026-09-25',7,'p1');
  expect(result.occupiedNights).toBe(4); expect(result.occupancy).toBe(57);
 });
 it('compares equal periods and never counts future-created records in the current period',()=>{
  const result=summarize([row,{...row,id:'previous',created_at:'2026-09-17T10:00:00Z'},{...row,id:'future',created_at:'2026-09-26T10:00:00Z'}],properties,'2026-09-25',7);
  expect(result.bookings).toBe(1); expect(result.previousBookings).toBe(1); expect(result.previousValue).toBe(3000000);
 });
 it('returns truthful zero states for an empty account',()=>{
  const result=summarize([],[],'2026-09-25',30); expect(result.occupancy).toBe(0);expect(result.value).toBe(0);expect(result.recent).toEqual([]);expect(result.upcoming).toEqual([]);
 });
});
