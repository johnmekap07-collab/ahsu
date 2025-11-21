export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export interface Bird {
  y: number;
  velocity: number;
  rotation: number;
}

export interface Pipe {
  x: number;
  topHeight: number;
  passed: boolean;
}

export interface HighScore {
  score: number;
  timestamp: number;
}