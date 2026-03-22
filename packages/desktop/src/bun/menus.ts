import { ApplicationMenu } from "electrobun/bun"

export function createApplicationMenu() {
  ApplicationMenu.setApplicationMenu([
    {
      label: "CR",
      submenu: [
        { label: "About CR", role: "about" },
        { type: "separator" },
        { label: "Hide CR", role: "hide" },
        { label: "Hide Others", role: "hideOthers" },
        { label: "Show All", role: "showAll" },
        { type: "separator" },
        { label: "Quit CR", role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Toggle Full Screen", role: "toggleFullScreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "close" },
      ],
    },
  ])
}
