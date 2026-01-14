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
    path: 'record-form',
    loadComponent: () => import('./pages/record-form/record-form.page').then(m => m.RecordFormPage),
  },
  {
    path: 'record-list',
    loadComponent: () => import('./pages/record-list/record-list.page').then(m => m.RecordListPage),
  },
  {
    path: 'record-detail/:id',
    loadComponent: () => import('./pages/record-detail/record-detail.page').then(m => m.RecordDetailPage),
  },
  {
    path: 'camera-capture/:id',
    loadComponent: () => import('./pages/camera-capture/camera-capture.page').then(m => m.CameraCapturePage),
  },
  {
    path: 'media-preview/:id',
    loadComponent: () => import('./components/media-preview/media-preview.component').then(m => m.MediaPreviewComponent),
  },
];
