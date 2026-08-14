export const transitions: [string, string, string][] = [
  ["", "*", "uninstalled"],
  ["uninstalled", "install", "installed"],
  ["installed", "launch", "main screen"],
  ["main screen", "click", "main screen"],
  ["main screen", "subscribe", "subscriptions"],
  ["subscriptions", "choose\nplan", "confirmation"],
  ["subscriptions", "click", "main screen"],
  ["confirmation", "confirm", "subcribed"],
  ["confirmation", "cancel", "subscriptions"],
  ["subcribed", "click", "main screen"],
  ["main screen", "exit", ""],
];
