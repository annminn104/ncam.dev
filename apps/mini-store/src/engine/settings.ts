// What the visitor can change. Apart from engine.ts so the React shell can import it without
// pulling the renderer into the first bundle.
export interface Settings {
  rain: number;
  exposure: number;
  fog: number;
  bloom: number;
  ao: boolean;
  traffic: boolean;
  cruise: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  rain: 1,
  exposure: 1.25,
  fog: 0.35,
  bloom: 1,
  ao: true,
  traffic: true,
  cruise: false,
};
