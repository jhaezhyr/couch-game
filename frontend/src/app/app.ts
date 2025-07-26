import { Component, signal } from '@angular/core';
import { Lobby } from './components/lobby/lobby';

@Component({
  selector: 'app-root',
  imports: [Lobby],
  templateUrl: './app.html',
  styleUrl: './app.less',
})
export class App {
  protected readonly title = signal('Couch Game');
}
