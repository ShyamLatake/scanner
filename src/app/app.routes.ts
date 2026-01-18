import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.page').then(m => m.HomePage),
  },
  {
    path: 'camera-capture/:id',
    loadComponent: () => import('./pages/camera-capture/camera-capture.page').then(m => m.CameraCapturePage),
  },
  {
    path: '**',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
