import { Injectable, signal, computed } from '@angular/core';

export type ToastType = 'info' | 'success' | 'error';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private messages = signal<ToastMessage[]>([]);

  public readonly toasts = computed(() => this.messages());

  show(message: string, type: ToastType = 'info', durationMs = 4000): void {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const toast: ToastMessage = { id, message, type };
    this.messages.update((arr) => [...arr, toast]);
    
    setTimeout(() => {
      const element = document.querySelector(`[data-toast-id="${id}"]`);
      if (element) {
        element.classList.add('dismissing');
        setTimeout(() => this.dismiss(id), 300);
      } else {
        this.dismiss(id);
      }
    }, durationMs);
  }

  dismiss(id: number): void {
    this.messages.update((arr) => arr.filter((t) => t.id !== id));
  }

  clear(): void {
    this.messages.set([]);
  }
}
