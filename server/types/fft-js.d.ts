declare module "fft-js" {
  export function fft(signal: number[]): Array<[number, number]>;
  export function ifft(spectrum: Array<[number, number]>): Array<[number, number]>;
  export const util: {
    fftFreq(spectrum: Array<[number, number]>, sampleRate: number): number[];
    fftMag(spectrum: Array<[number, number]>): number[];
  };
}
