import { ApplicationMenu } from "electrobun/bun"

export function createApplicationMenu() {
  ApplicationMenu.setApplicationMenu([
    {
      label: "PeerView",
      submenu: [
        { label: "About PeerView", role: "about" },
        { type: "separator" },
        { label: "Hide PeerView", role: "hide" },
        { label: "Hide Others", role: "hideOthers" },
        { label: "Show All", role: "showAll" },
        { type: "separator" },
        { label: "Quit PeerView", role: "quit" },
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
