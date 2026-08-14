import type { FsmStateConfig } from "../../src/types/FsmStateConfig.js";
export const process: FsmStateConfig = {
  key: "App",
  transitions: [
    ["", "*", "OpenFileSystem"],
    ["OpenFileSystem", "error", "ShowError"],
    ["OpenFileSystem", "ok", "OpenFileSystem"],
    ["OpenFileSystem", "exit", ""],
    ["ShowError", "ok", "OpenFileSystem"],
  ],
  states: [
    {
      key: "OpenFileSystem",
      transitions: [
        ["", "*", "ChooseFolder"],
        ["ChooseFolder", "ok", "CheckFolderAccess"],
        ["CheckFolderAccess", "ok", ""],
        ["CheckFolderAccess", "error", ""],
      ],
      states: [
        {
          key: "ChooseFolder",
          transitions: [
            ["", "*", "A"],
            ["A", "ok", "B"],
            ["A", "check", "C"],
            ["C", "ok", "B"],
            ["B", "cancel", "A"],
          ],
        },
      ],
    },
    {
      key: "ShowError",
      transitions: [
        ["", "*", "ShowMessage"],
        ["ShowMessage", "details", "ShowDetailedMessage"],
        ["ShowDetailedMessage", "back", "ShowMessage"],
      ],
    },
  ],
};
