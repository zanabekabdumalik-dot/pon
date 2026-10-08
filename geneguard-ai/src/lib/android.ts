// Android app only (loaded from main.tsx when VITE_TARGET is "android").

import { App } from '@capacitor/app';

/** Hardware back button: go back inside the app, and close it from the first screen. */
export function setupAndroid() {
  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.exitApp();
  });
}
