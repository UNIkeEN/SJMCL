(() => {
  if (window.__SJMCL_WINDOWS_OVERLAY_CONTROLS__) {
    return;
  }
  window.__SJMCL_WINDOWS_OVERLAY_CONTROLS__ = true;

  const styleId = "sjmcl-windows-overlay-controls-style";
  const controlsClass = "sjmcl-windows-overlay-controls";
  const buttonClass = "decorum-tb-btn";
  const maximizeBtnClass = "sjmcl-maximize-btn";

  const icons = {
    minimize:
      '<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M1 5h8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    maximize:
      '<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><rect x="1.4" y="1.4" width="7.2" height="7.2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
    restore:
      '<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2.2 3.4h4.4v4.4H2.2z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M3.4 2.2h4.4v4.4" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>',
    close:
      '<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  };

  const getCurrentWindow = () =>
    window.__TAURI__?.window?.getCurrentWindow
      ? window.__TAURI__.window.getCurrentWindow()
      : null;

  const setMaximizeButtonState = async (button) => {
    const currentWindow = getCurrentWindow();
    if (!button || !currentWindow) return;
    const maximized = await currentWindow.isMaximized();
    button.innerHTML = maximized ? icons.restore : icons.maximize;
    button.setAttribute("aria-label", maximized ? "Restore" : "Maximize");
    button.setAttribute("title", maximized ? "Restore" : "Maximize");
  };

  const createButton = (kind) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${buttonClass} sjmcl-${kind}-btn`;
    button.setAttribute("data-titlebar-control", "true");

    if (kind === "minimize") {
      button.innerHTML = icons.minimize;
      button.setAttribute("aria-label", "Minimize");
      button.setAttribute("title", "Minimize");
    } else if (kind === "maximize") {
      button.innerHTML = icons.maximize;
      button.classList.add(maximizeBtnClass);
      button.setAttribute("aria-label", "Maximize");
      button.setAttribute("title", "Maximize");
    } else {
      button.innerHTML = icons.close;
      button.classList.add("close");
      button.setAttribute("aria-label", "Close");
      button.setAttribute("title", "Close");
    }

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const currentWindow = getCurrentWindow();
      if (!currentWindow) return;

      if (kind === "minimize") {
        await currentWindow.minimize();
        return;
      }
      if (kind === "maximize") {
        await currentWindow.toggleMaximize();
        await setMaximizeButtonState(button);
        return;
      }
      await currentWindow.close();
    });

    return button;
  };

  const ensureStyles = () => {
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      [data-tauri-decorum-tb] {
        display: flex;
        align-items: stretch;
        justify-content: flex-end;
        height: 100%;
      }

      .${controlsClass} {
        display: flex;
        align-items: stretch;
        height: 100%;
      }

      .${buttonClass} {
        width: 44px;
        height: 100%;
        border: none;
        margin: 0;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--chakra-colors-chakra-body-text, rgba(0, 0, 0, 0.9));
        background: transparent;
        transition: background-color 120ms ease;
      }

      .${buttonClass}:hover {
        background-color: rgba(128, 128, 128, 0.25);
      }

      .${buttonClass}.close:hover {
        background-color: #e81123;
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  };

  const mountControls = () => {
    const host = document.querySelector("[data-tauri-decorum-tb]");
    if (!host || host.querySelector(`.${controlsClass}`)) return;

    const controls = document.createElement("div");
    controls.className = controlsClass;
    controls.appendChild(createButton("minimize"));
    controls.appendChild(createButton("maximize"));
    controls.appendChild(createButton("close"));
    host.appendChild(controls);

    const maximizeButton = controls.querySelector(`.${maximizeBtnClass}`);
    if (maximizeButton) {
      void setMaximizeButtonState(maximizeButton);
      const currentWindow = getCurrentWindow();
      if (currentWindow && !window.__SJMCL_WINDOWS_OVERLAY_LISTENER__) {
        window.__SJMCL_WINDOWS_OVERLAY_LISTENER__ = true;
        currentWindow.onResized(() => {
          const btn = document.querySelector(`.${maximizeBtnClass}`);
          if (btn) {
            void setMaximizeButtonState(btn);
          }
        });
      }
    }
  };

  const start = () => {
    ensureStyles();
    mountControls();
    const observer = new MutationObserver(() => {
      mountControls();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
