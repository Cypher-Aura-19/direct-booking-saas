import { test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardHome } from './dashboard-home';
// @req AUTH-13
test('empty overview shows honest analytics and attention state',()=>{
 render(<DashboardHome today="2026-09-25" />);
 expect(screen.getByText(/nothing needs you right now/i)).toBeInTheDocument();
 expect(screen.getByText(/no bookings in this period/i)).toBeInTheDocument();
});
// @req INBOX-09
test('an honest unread count replaces the old "not available yet" disclaimer', () => {
  render(<DashboardHome today="2026-09-25" unreadCount={3} />);
  expect(screen.queryByText(/read tracking is not available/i)).not.toBeInTheDocument();
  expect(screen.getByText('Unread messages')).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument();
});
// @req INBOX-12
test('the escalated-chats row links through to the inbox, filtered', () => {
  render(<DashboardHome today="2026-09-25" escalatedCount={2} />);
  expect(screen.getByRole('link', { name: /escalated chats/i })).toHaveAttribute('href', '/dashboard/inbox?filter=escalated');
});
// @req AUTH-13
// @req INBOX-12
test('overview filters analytics by period and property',()=>{
 render(<DashboardHome today="2026-09-25" properties={[{id:'p1',name:'River Hut',published:true},{id:'p2',name:'Hill House',published:true}]} bookings={[{id:'b1',property_id:'p1',start_date:'2026-10-01',end_date:'2026-10-03',created_at:'2026-09-10T10:00:00Z',status:'requested',total_price_cents:2000000}]} escalatedCount={2} />);
 expect(screen.getByText('1 this period')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Last 7 days'}));
 expect(screen.getByText('0 this period')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Last 30 days'}));
 fireEvent.change(screen.getByRole('combobox',{name:'Filter analytics by property'}),{target:{value:'p2'}});
 expect(screen.getByText('0 this period')).toBeInTheDocument();
 expect(screen.getByText('Waiting booking requests')).toBeInTheDocument();
 expect(screen.getByText('Escalated chats')).toBeInTheDocument();
});

// @req BOOK-05
test('the waiting-requests row links to the pending bookings', () => {
  render(<DashboardHome today="2026-09-25" />);
  expect(screen.getByRole('link', { name: /waiting booking requests/i })).toHaveAttribute('href', '/dashboard/bookings?status=requested');
});
