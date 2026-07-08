import { biosSettings } from "./BIOSSettings";

export const applyFullScreenState = () => {
    const isFullScreen = biosSettings.getSetting("zoom");
    const body = document.body;
    if (isFullScreen) {
        body.classList.add("full-screen");
    } else {
        body.classList.remove("full-screen");
    }
};
