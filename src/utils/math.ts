export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const areArraysEqual = <T>(
  left: T[],
  right: T[],
  isEqual: (leftValue: T, rightValue: T) => boolean = Object.is
) => {
  return (
    left.length === right.length &&
    left.every((value, index) => isEqual(value, right[index]))
  );
};
