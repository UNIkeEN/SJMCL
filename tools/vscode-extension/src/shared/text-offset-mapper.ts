import * as vscode from "vscode";

export class TextOffsetMapper {
  private readonly lineStarts: number[];

  constructor(text: string) {
    this.lineStarts = [0];
    for (let i = 0; i < text.length; i += 1) {
      if (text.charCodeAt(i) === 10) {
        this.lineStarts.push(i + 1);
      }
    }
  }

  toPosition(offset: number): vscode.Position {
    const safeOffset = Math.max(0, offset);

    let low = 0;
    let high = this.lineStarts.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const lineStart = this.lineStarts[mid];
      const nextStart =
        mid + 1 < this.lineStarts.length ? this.lineStarts[mid + 1] : Infinity;

      if (safeOffset >= lineStart && safeOffset < nextStart) {
        return new vscode.Position(mid, safeOffset - lineStart);
      }

      if (safeOffset < lineStart) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    const fallbackLine = Math.max(0, this.lineStarts.length - 1);
    return new vscode.Position(
      fallbackLine,
      safeOffset - this.lineStarts[fallbackLine]
    );
  }
}
