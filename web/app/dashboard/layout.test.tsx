import { test, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { DashboardNav } from './dashboard-nav';
// @req AUTH-14
test('dashboard navigation supports accessible collapse and reachable mobile destinations',()=>{
 render(<DashboardNav />);
 const sidebar=screen.getByTestId('dashboard-sidebar'), mobile=screen.getByTestId('dashboard-tabbar');
 expect(sidebar.className).toMatch(/hidden/);expect(sidebar.className).toMatch(/md:flex/);expect(mobile.className).toMatch(/md:hidden/);
 for(const label of ['Home','Properties','Settings'])expect(within(sidebar).getByRole('link',{name:label})).toBeInTheDocument();
 expect(within(sidebar).getByText('Inbox').closest('[aria-disabled]')).toHaveAttribute('aria-disabled','true');
 expect(within(sidebar).getByText('Calendar').closest('[aria-disabled]')).toHaveAttribute('aria-disabled','true');
 fireEvent.click(screen.getByRole('button',{name:'Collapse sidebar'}));
 expect(sidebar).toHaveClass('is-collapsed');expect(screen.getByRole('button',{name:'Expand sidebar'})).toHaveAttribute('aria-expanded','false');
 fireEvent.click(screen.getByRole('button',{name:'Expand sidebar'}));expect(sidebar).not.toHaveClass('is-collapsed');
 expect(within(mobile).getByRole('link',{name:'Properties'})).toHaveAttribute('href','/dashboard/properties');
});
