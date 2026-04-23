import { fullScreenLocalStorageKey } from "./constants";

export const applyFullScreenState = () => {
    const isFullScreen = localStorage.getItem(fullScreenLocalStorageKey);
    const body = document.body;
    if (isFullScreen === "true") {
        body.classList.add("full-screen");
    } else {
        body.classList.remove("full-screen");
    }
};
