/**
 * Public Layout — For unauthenticated pages
 */

import { Outlet } from 'react-router-dom';
import { BackendUnavailableBanner } from '@/components/BackendUnavailableBanner';

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <BackendUnavailableBanner />
      <Outlet />
    </div>
  );
}
