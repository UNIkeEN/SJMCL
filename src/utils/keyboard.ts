import type { KeyboardEvent } from "react";

/**
 * Create an `onKeyDown` handler for inputs, which calls `callback` when Enter is pressed,
 * e.g. to trigger the confirm button of a modal.
 *
 * The Enter key used to commit an IME composition (e.g. Chinese or Japanese input) is ignored.
 * WebKit dispatches that keydown with `isComposing` false, so `keyCode` 229 is checked as well.
 */
export const onEnterKeyDown =
  (callback: () => void, isDisabled: boolean = false) =>
  (event: KeyboardEvent<HTMLElement>) => {
    if (
      event.key !== "Enter" ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229 ||
      isDisabled
    )
      return;
    event.preventDefault();
    callback();
  };
