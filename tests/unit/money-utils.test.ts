import { toCents, toDollars, addDollars, multiplyDollars, percentageDollars } from "../../shared/money-utils";

describe("Money Utils", () => {
  describe("toCents", () => {
    it("converts positive dollars to cents", () => {
      expect(toCents(19.99)).toBe(1999);
      expect(toCents(1)).toBe(100);
      expect(toCents(0.01)).toBe(1);
    });

    it("converts negative dollars to cents", () => {
      expect(toCents(-10.50)).toBe(-1050);
    });

    it("handles zero", () => {
      expect(toCents(0)).toBe(0);
    });

    it("handles null and undefined", () => {
      expect(toCents(null)).toBe(0);
      expect(toCents(undefined)).toBe(0);
    });

    it("handles NaN and Infinity", () => {
      expect(toCents(NaN)).toBe(0);
      expect(toCents(Infinity)).toBe(0);
      expect(toCents(-Infinity)).toBe(0);
    });

    it("rounds to nearest cent", () => {
      expect(toCents(19.999)).toBe(2000);
      expect(toCents(19.994)).toBe(1999);
    });
  });

  describe("toDollars", () => {
    it("converts cents to dollars", () => {
      expect(toDollars(1999)).toBe(19.99);
      expect(toDollars(100)).toBe(1);
      expect(toDollars(1)).toBe(0.01);
    });

    it("handles zero", () => {
      expect(toDollars(0)).toBe(0);
    });

    it("handles null and undefined", () => {
      expect(toDollars(null)).toBe(0);
      expect(toDollars(undefined)).toBe(0);
    });

    it("handles negative cents", () => {
      expect(toDollars(-1050)).toBe(-10.5);
    });
  });

  describe("addDollars", () => {
    it("adds two dollar amounts precisely", () => {
      expect(addDollars(19.99, 5.01)).toBe(25.00);
    });

    it("avoids floating point errors", () => {
      expect(addDollars(0.1, 0.2)).toBe(0.3);
    });

    it("handles negative amounts", () => {
      expect(addDollars(100, -25.50)).toBe(74.5);
    });
  });

  describe("multiplyDollars", () => {
    it("multiplies unit price by quantity", () => {
      expect(multiplyDollars(19.99, 3)).toBe(59.97);
    });

    it("handles zero quantity", () => {
      expect(multiplyDollars(19.99, 0)).toBe(0);
    });

    it("avoids floating point errors", () => {
      const result = multiplyDollars(19.99, 3);
      expect(result).not.toBe(59.97000000000001);
      expect(result).toBe(59.97);
    });
  });

  describe("percentageDollars", () => {
    it("calculates percentage of dollar amount", () => {
      expect(percentageDollars(100, 15)).toBe(15);
    });

    it("handles 10% discount", () => {
      expect(percentageDollars(19.99, 10)).toBe(2);
    });

    it("handles 100%", () => {
      expect(percentageDollars(50, 100)).toBe(50);
    });

    it("handles 0%", () => {
      expect(percentageDollars(50, 0)).toBe(0);
    });
  });
});
