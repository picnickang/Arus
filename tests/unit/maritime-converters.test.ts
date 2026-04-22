import {
  windSpeedToBeaufort,
  waveHeightToSeaState,
  bearingToDirection,
  BEAUFORT_DESCRIPTIONS,
  SEA_STATE_DESCRIPTIONS,
} from "../../shared/lib/maritime-converters";

describe("Maritime Converters", () => {
  describe("windSpeedToBeaufort", () => {
    it("returns 0 for calm conditions", () => {
      expect(windSpeedToBeaufort(0)).toBe(0);
      expect(windSpeedToBeaufort(0.2)).toBe(0);
    });

    it("returns correct Beaufort for light wind", () => {
      expect(windSpeedToBeaufort(0.5)).toBe(1);
      expect(windSpeedToBeaufort(2.0)).toBe(2);
      expect(windSpeedToBeaufort(4.0)).toBe(3);
    });

    it("returns correct Beaufort for moderate wind", () => {
      expect(windSpeedToBeaufort(6.0)).toBe(4);
      expect(windSpeedToBeaufort(9.0)).toBe(5);
      expect(windSpeedToBeaufort(12.0)).toBe(6);
    });

    it("returns correct Beaufort for strong wind and gale", () => {
      expect(windSpeedToBeaufort(15.0)).toBe(7);
      expect(windSpeedToBeaufort(19.0)).toBe(8);
      expect(windSpeedToBeaufort(23.0)).toBe(9);
    });

    it("returns correct Beaufort for storm to hurricane", () => {
      expect(windSpeedToBeaufort(26.0)).toBe(10);
      expect(windSpeedToBeaufort(30.0)).toBe(11);
      expect(windSpeedToBeaufort(35.0)).toBe(12);
      expect(windSpeedToBeaufort(100.0)).toBe(12);
    });

    it("handles boundary values correctly", () => {
      expect(windSpeedToBeaufort(0.3)).toBe(1);
      expect(windSpeedToBeaufort(0.29)).toBe(0);
      expect(windSpeedToBeaufort(32.7)).toBe(12);
      expect(windSpeedToBeaufort(32.69)).toBe(11);
    });
  });

  describe("waveHeightToSeaState", () => {
    it("returns 0 for calm (glassy)", () => {
      expect(waveHeightToSeaState(0)).toBe(0);
      expect(waveHeightToSeaState(0.05)).toBe(0);
    });

    it("returns correct sea states for increasing wave heights", () => {
      expect(waveHeightToSeaState(0.3)).toBe(2);
      expect(waveHeightToSeaState(1.0)).toBe(3);
      expect(waveHeightToSeaState(2.0)).toBe(4);
      expect(waveHeightToSeaState(3.0)).toBe(5);
      expect(waveHeightToSeaState(5.0)).toBe(6);
      expect(waveHeightToSeaState(7.0)).toBe(7);
      expect(waveHeightToSeaState(12.0)).toBe(8);
    });

    it("returns 9 for phenomenal seas", () => {
      expect(waveHeightToSeaState(14)).toBe(9);
      expect(waveHeightToSeaState(20)).toBe(9);
    });
  });

  describe("bearingToDirection", () => {
    it("converts cardinal directions", () => {
      expect(bearingToDirection(0)).toBe("N");
      expect(bearingToDirection(90)).toBe("E");
      expect(bearingToDirection(180)).toBe("S");
      expect(bearingToDirection(270)).toBe("W");
    });

    it("converts intercardinal directions", () => {
      expect(bearingToDirection(45)).toBe("NE");
      expect(bearingToDirection(135)).toBe("SE");
      expect(bearingToDirection(225)).toBe("SW");
      expect(bearingToDirection(315)).toBe("NW");
    });

    it("wraps around 360 degrees", () => {
      expect(bearingToDirection(360)).toBe("N");
    });

    it("handles intermediate bearings", () => {
      expect(bearingToDirection(22.5)).toBe("NNE");
      expect(bearingToDirection(67.5)).toBe("ENE");
      expect(bearingToDirection(157.5)).toBe("SSE");
    });
  });

  describe("description lookups", () => {
    it("has descriptions for all 13 Beaufort levels", () => {
      for (let i = 0; i <= 12; i++) {
        expect(BEAUFORT_DESCRIPTIONS[i]).toBeDefined();
        expect(typeof BEAUFORT_DESCRIPTIONS[i]).toBe("string");
      }
    });

    it("has descriptions for all sea states 0-9", () => {
      for (let i = 0; i <= 9; i++) {
        expect(SEA_STATE_DESCRIPTIONS[i]).toBeDefined();
      }
    });
  });
});
