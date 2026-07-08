export type BIOSFontFamily = "vga" | "terminus";

export interface BIOSSettingsData {
    font: BIOSFontFamily;
    zoom: boolean;
}

const STORAGE_KEY = "biosSettings";

const DEFAULT_BIOS_SETTINGS: BIOSSettingsData = {
    font: "vga",
    zoom: false,
};

class BIOSSettingsStore {
    private readStoredSettings(): Partial<BIOSSettingsData> | null {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    private persistSettings(settings: BIOSSettingsData) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    /** Seeds localStorage with default BIOS settings if none are present yet. */
    init(): BIOSSettingsData {
        const stored = this.readStoredSettings();
        const settings: BIOSSettingsData = { ...DEFAULT_BIOS_SETTINGS, ...stored };
        this.persistSettings(settings);
        return settings;
    }

    getSettings(): BIOSSettingsData {
        const stored = this.readStoredSettings();
        if (!stored) {
            return this.init();
        }
        return { ...DEFAULT_BIOS_SETTINGS, ...stored };
    }

    getSetting<K extends keyof BIOSSettingsData>(key: K): BIOSSettingsData[K] {
        return this.getSettings()[key];
    }

    setSetting<K extends keyof BIOSSettingsData>(
        key: K,
        value: BIOSSettingsData[K],
    ) {
        const settings = this.getSettings();
        settings[key] = value;
        this.persistSettings(settings);
    }

    setSettings(settings: BIOSSettingsData) {
        this.persistSettings(settings);
    }
}

export const biosSettings = new BIOSSettingsStore();
