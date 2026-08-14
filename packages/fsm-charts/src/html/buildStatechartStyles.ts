import type { CssTree } from "../utils/serializeCss.js";

export const activeStatesStyle = {
  backgroundColor: "white",
  borderColor: "red",
  borderWidth: "2px",
  labelColor: "red",
};
export const activeTransitionsStyle = {
  backgroundColor: "#eee",
  borderColor: "none",
  borderWidth: "0",
  lineColor: "red",
  lineWidth: "1px",
  labelColor: "red",
};

export const selectedStatesStyle = {
  backgroundColor: "white",
  borderColor: "navy",
  borderWidth: "2px",
  labelColor: "navy",
};
export const selectedTransitionsStyle = {
  backgroundColor: "#eee",
  borderColor: "none",
  borderWidth: "0",
  lineColor: "navy",
  lineWidth: "1px",
  labelColor: "navy",
};

export function buildStateDetailsStyle({
  root = ":root",
}: {
  root?: string;
}): CssTree {
  return {
    [root]: {
      // --------------------------
      // Panels

      ".state-details": {
        backgroundColor: "var(--state-background-color, white)",
        border:
          "var(--state-border-width, 1px) solid var(--state-border-color, currentColor)",
        borderRadius: "0.5em",
        padding: "0.5em",
      },
      ".state-details__label": {
        cursor: "pointer",
        color: "var(--transition-label-color, currentColor)",
        fontFamily: "var(--state-label-font-family, sans-serif)",
        fontSize: "var(--state-label-font-size, 14px)",
      },
      ".state-details__content": {
        display: "flex",
        flexDirection: "column",
        gap: "0.5em",
      },
      ".state-details__chart": {
        maxWidth: "100%",
        overflow: "auto",
        scrollbarWidth: "thin",
      },
    },
  };
}

export function buildStateDetailsStyleWithModifier({
  root = ":root",
  modifier,
  states,
}: {
  root?: string;
  modifier: string;
  states: Record<string, string>;
}): CssTree {
  return {
    [root]: {
      //
      ".state-details": {
        [`&.state-details--${modifier}`]: {
          backgroundColor: `var(--state-${modifier}-background-color, ${states.backgroundColor})`,
          border: `var(--state-${modifier}-border-width, 1px) solid var(--state-${modifier}-border-color, currentColor)`,
        },
      },
      ".state-details__label": {
        [`&.state-details__label--${modifier}`]: {
          color: `var(--state-${modifier}-label-color)`,
        },
      },
    },
  };
}

export function buildStatechartStylesWithModifier({
  root = ":root",
  modifier,
  states,
  transitions,
}: {
  root?: string;
  modifier: string;
  states: Record<string, string>;
  transitions: Record<string, string>;
}): CssTree {
  return {
    [root]: {
      // --------------------------------------
      // Default values for transitions
      [`--transition-${modifier}-background-color`]:
        transitions.backgroundColor,
      [`--transition-${modifier}-border-color`]: transitions.borderColor,
      [`--transition-${modifier}-border-width`]: transitions.borderWidth,
      [`--transition-${modifier}-line-color`]: transitions.lineColor,
      [`--transition-${modifier}-line-width`]: transitions.lineWidth,
      [`--transition-${modifier}-label-color`]: transitions.labelColor,

      // --------------------------------------
      // Default values for states
      [`--state-${modifier}-background-color`]: states.backgroundColor,
      [`--state-${modifier}-border-color`]: states.borderColor,
      [`--state-${modifier}-border-width`]: states.borderWidth,
      [`--state-${modifier}-label-color`]: states.labelColor,

      ".state": {
        [`&.state--${modifier}`]: {
          "--state-background-color": `var(--state-${modifier}-background-color)`,
          "--state-border-color": `var(--state-${modifier}-border-color)`,
          "--state-border-width": `var(--state-${modifier}-border-width)`,
          "--state-label-color": `var(--state-${modifier}-label-color)`,
        },
      },

      ".transition": {
        [`&.transition--${modifier}`]: {
          "--transition-background-color": `var(--transition-${modifier}-background-color)`,
          "--transition-border-color": `var(--transition-${modifier}-border-color)`,
          "--transition-border-width": `var(--transition-${modifier}-border-width)`,
          "--transition-line-color": `var(--transition-${modifier}-line-color)`,
          "--transition-line-width": `var(--transition-${modifier}-line-width)`,
          "--transition-label-color": `var(--transition-${modifier}-label-color)`,
        },
      },
    },
  };
}

export function buildStatechartStyles({
  root = ":root",
}: {
  root?: string;
}): CssTree {
  return {
    [root]: {
      // --------------------------------------
      // Transitions
      "--transition-background-color": "rgba(255,255,255,0.7)",
      "--transition-border-color": "none",
      "--transition-border-width": "1px",
      "--transition-line-color": "silver",
      "--transition-line-width": "1px",
      "--transition-label-color": "gray",
      "--transition-label-font-size": "12px",
      "--transition-label-font-family": "sans-serif",

      ".transition__marker": {
        fill: "var(--transition-line-color, currentColor)",
        stroke: "none",
      },
      ".transition__line": {
        stroke: "var(--transition-line-color, currentColor)",
        strokeWidth: "var(--transition-line-width, 1px)",
      },
      ".transition__box": {
        fill: "var(--transition-background-color, rgba(255,255,255,0.7))",
        stroke: "var(--transition-border-color, none)",
        strokeWidth: "var(--transition-border-width, 1px)",
        borderRadius: "0.5em",
        cursor: "pointer",
      },
      ".transition__label": {
        fill: "var(--transition-label-color, currentColor)",
        fontSize: "var(--transition-label-font-size, 12px)",
        fontFamily: "var(--transition-label-font-family, sans-serif)",
        cursor: "pointer",
      },

      // --------------------------------------
      // Normal states
      "--state-background-color": "white",
      "--state-border-color": "silver",
      "--state-border-width": "1px",
      "--state-label-color": "gray",
      "--state-label-font-size": "14px",
      "--state-label-font-family": "sans-serif",

      ".state__box": {
        fill: "var(--state-background-color, white)",
        stroke: "var(--state-border-color, currentColor)",
        strokeWidth: "var(--state-border-width, 1px)",
        borderRadius: "0.5em",
        cursor: "pointer",
      },
      ".state__label": {
        color: "var(--state-label-color, currentColor)",
        fill: "var(--state-label-color, currentColor)",
        fontSize: "var(--state-label-font-size, 14px)",
        fontFamily: "var(--state-label-font-family, sans-serif)",
        cursor: "pointer",
      },
      ".state__initial": {
        fill: "var(--state-border-color, currentColor)",
        stroke: "var(--state-border-color, currentColor)",
        strokeWidth: "var(--state-border-width, 2px)",
      },
      ".state__final": {
        fill: "white",
        stroke: "var(--state-border-color, currentColor)",
        strokeWidth: "var(--state-border-width, 2px)",
        // ---------------------------
        "&.state__final--inner": {
          fill: "var(--state-border-color, currentColor)",
          stroke: "none",
          strokeWidth: "0",
        },
      },
    },
  };
}
